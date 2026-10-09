local tool = renoise.tool()
local OscMessage = renoise.Osc.Message
local UDP = renoise.Socket.PROTOCOL_UDP

local prefs = renoise.Document.create("GenerantOscPreferences") {
  host = "127.0.0.1",
  generant_port = 57142,
  blender_port = 57141,
  sync_transport = true,
  sync_sequence = true,
  cue_address = "/visual/kick",
  cue_type = 1,
  cue_value = "1",
  pulse_ms = 80,
  pattern = "Pattern 00",
  device = "keys",
  parameter = "cutoff",
  parameter_value = 1000
}
tool.preferences = prefs

local clients = {}
local dialog = nil
local attached_song = nil

local function close_clients()
  for _, client in pairs(clients) do pcall(function() client:close() end) end
  clients = {}
end

local function client_for(port)
  if clients[port] then return clients[port] end
  local client, socket_error = renoise.Socket.create_client(prefs.host.value, port, UDP)
  if socket_error then error(socket_error) end
  clients[port] = client
  return client
end

local function osc_arg(value)
  if type(value) == "string" then return {tag = "s", value = value} end
  if type(value) == "number" then
    if value == math.floor(value) and value >= -2147483648 and value <= 2147483647 then return {tag = "i", value = value} end
    return {tag = "f", value = value}
  end
  error("OSC arguments must be numbers or strings")
end

local function send(port, address, values)
  if type(address) ~= "string" or address:sub(1, 1) ~= "/" then error("OSC address must begin with /") end
  local args = {}
  for _, value in ipairs(values or {}) do table.insert(args, osc_arg(value)) end
  local success, socket_error = client_for(port):send(OscMessage(address, args).binary_data)
  if not success then error(socket_error or "OSC send failed") end
  renoise.app():show_status(("OSC → %s:%d %s"):format(prefs.host.value, port, address))
end

local function generant(address, values)
  local ok, err = pcall(send, prefs.generant_port.value, "/generant/v1" .. address, values)
  if not ok then renoise.app():show_warning("Generant OSC: " .. tostring(err)) end
end

local function blender(address, values)
  local ok, err = pcall(send, prefs.blender_port.value, address, values)
  if not ok then renoise.app():show_warning("Blender OSC: " .. tostring(err)) end
end

local function send_tempo()
  if renoise.song() then generant("/transport/tempo", {renoise.song().transport.bpm}) end
end

local function on_playing()
  if not prefs.sync_transport.value or not renoise.song() then return end
  if renoise.song().transport.playing then send_tempo(); generant("/transport/play")
  else generant("/transport/stop") end
end

local function on_bpm()
  if prefs.sync_transport.value and renoise.song() and not renoise.song().transport.playing then send_tempo() end
end

local function on_sequence()
  if prefs.sync_sequence.value and renoise.song() then
    generant("/song/position/queue", {renoise.song().selected_sequence_index - 1})
  end
end

local function detach_song()
  if not attached_song then return end
  local transport = attached_song.transport
  if transport.playing_observable:has_notifier(on_playing) then transport.playing_observable:remove_notifier(on_playing) end
  if transport.bpm_observable:has_notifier(on_bpm) then transport.bpm_observable:remove_notifier(on_bpm) end
  if attached_song.selected_sequence_index_observable:has_notifier(on_sequence) then attached_song.selected_sequence_index_observable:remove_notifier(on_sequence) end
  attached_song = nil
end

local function attach_song()
  detach_song()
  attached_song = renoise.song()
  if not attached_song then return end
  attached_song.transport.playing_observable:add_notifier(on_playing)
  attached_song.transport.bpm_observable:add_notifier(on_bpm)
  attached_song.selected_sequence_index_observable:add_notifier(on_sequence)
end

local function cue_values(vb)
  local kind = vb.views.cue_type.value
  if kind == 3 then return {} end
  if kind == 2 then return {vb.views.cue_value.value} end
  local value = tonumber(vb.views.cue_value.value)
  if not value then error("Numeric cue value is not a number") end
  return {value}
end

local function show_panel()
  if dialog and dialog.visible then dialog:show(); return end
  local vb = renoise.ViewBuilder()
  local width = 150
  local content = vb:column {
    margin = 10, spacing = 8,
    vb:text {text = "Connections", font = "bold"},
    vb:row {spacing = 6, vb:text {text = "Host", width = 90}, vb:textfield {width = width, value = prefs.host.value, notifier = function(v) prefs.host.value = v; close_clients() end}},
    vb:row {spacing = 6, vb:text {text = "Generant port", width = 90}, vb:valuefield {width = width, min = 1024, max = 65535, value = prefs.generant_port.value, notifier = function(v) prefs.generant_port.value = v; close_clients() end}},
    vb:row {spacing = 6, vb:text {text = "Blender port", width = 90}, vb:valuefield {width = width, min = 1024, max = 65535, value = prefs.blender_port.value, notifier = function(v) prefs.blender_port.value = v; close_clients() end}},
    vb:space {height = 4},
    vb:text {text = "Renoise → Generant", font = "bold"},
    vb:row {vb:checkbox {value = prefs.sync_transport.value, notifier = function(v) prefs.sync_transport.value = v end}, vb:text {text = "Send tempo, play, and stop"}},
    vb:row {vb:checkbox {value = prefs.sync_sequence.value, notifier = function(v) prefs.sync_sequence.value = v end}, vb:text {text = "Queue selected sequence as song position"}},
    vb:row {spacing = 6, vb:button {text = "Tempo", notifier = send_tempo}, vb:button {text = "Play", notifier = function() send_tempo(); generant("/transport/play") end}, vb:button {text = "Stop", notifier = function() generant("/transport/stop") end}, vb:button {text = "Queue current sequence", notifier = on_sequence}},
    vb:row {spacing = 6, vb:text {text = "Pattern id/name", width = 90}, vb:textfield {id = "pattern", width = width, value = prefs.pattern.value, notifier = function(v) prefs.pattern.value = v end}, vb:button {text = "Queue", notifier = function() generant("/pattern/queue", {vb.views.pattern.value}) end}},
    vb:row {spacing = 6, vb:text {text = "Device", width = 90}, vb:textfield {id = "device", width = 80, value = prefs.device.value, notifier = function(v) prefs.device.value = v end}, vb:text {text = "Param"}, vb:textfield {id = "parameter", width = 80, value = prefs.parameter.value, notifier = function(v) prefs.parameter.value = v end}},
    vb:row {spacing = 6, vb:text {text = "Value", width = 90}, vb:valuefield {id = "parameter_value", width = width, min = -100000, max = 100000, value = prefs.parameter_value.value, notifier = function(v) prefs.parameter_value.value = v end}, vb:button {text = "Send parameter", notifier = function() generant("/device/param", {vb.views.device.value, vb.views.parameter.value, vb.views.parameter_value.value}) end}},
    vb:space {height = 4},
    vb:text {text = "Renoise → Blender", font = "bold"},
    vb:row {spacing = 6, vb:text {text = "Address", width = 90}, vb:textfield {id = "cue_address", width = width, value = prefs.cue_address.value, notifier = function(v) prefs.cue_address.value = v end}},
    vb:row {spacing = 6, vb:text {text = "Arguments", width = 90}, vb:popup {id = "cue_type", width = 80, items = {"number", "string", "none"}, value = prefs.cue_type.value, notifier = function(v) prefs.cue_type.value = v end}, vb:textfield {id = "cue_value", width = 100, value = prefs.cue_value.value, notifier = function(v) prefs.cue_value.value = v end}},
    vb:row {spacing = 6, vb:text {text = "Pulse release", width = 90}, vb:valuefield {id = "pulse_ms", width = 80, min = 1, max = 5000, value = prefs.pulse_ms.value, notifier = function(v) prefs.pulse_ms.value = v end}, vb:text {text = "ms"}, vb:button {text = "Send", notifier = function() local ok, values = pcall(cue_values, vb); if ok then blender(vb.views.cue_address.value, values) else renoise.app():show_warning(values) end end}, vb:button {text = "Pulse 1 → 0", notifier = function()
      blender(vb.views.cue_address.value, {1})
      local release
      release = function() tool:remove_timer(release); blender(vb.views.cue_address.value, {0}) end
      tool:add_timer(release, vb.views.pulse_ms.value)
    end}}
  }
  dialog = renoise.app():show_custom_dialog("Generant OSC", content, function(_dialog, key)
    if key.name == "esc" then _dialog:close(); return nil end
    return key
  end)
end

tool:add_menu_entry {name = "Main Menu:Tools:Generant OSC:Open panel", invoke = show_panel}
tool:add_keybinding {name = "Global:Tools:Generant OSC Panel", invoke = function() show_panel() end}
tool.app_new_document_observable:add_notifier(attach_song)
tool.app_release_document_observable:add_notifier(detach_song)
tool.tool_will_unload_observable:add_notifier(function() detach_song(); close_clients() end)
