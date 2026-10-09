"""
OSC Score Bridge — UI Panel
N-sidebar panel with Tracks, Mappings, and Docs sub-panels.
"""

import bpy


# ────────────────────────────────────────────────────────────
# Main Panel
# ────────────────────────────────────────────────────────────

class OSCBRIDGE_PT_main(bpy.types.Panel):
    bl_label = "OSC Score Bridge"
    bl_idname = "OSCBRIDGE_PT_main"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "OSC Bridge"

    def draw(self, context):
        layout = self.layout
        settings = context.scene.osc_bridge_settings

        # File path + Load button
        row = layout.row(align=True)
        row.prop(settings, "osc_file", text="")
        row.operator("oscbridge.load_file", text="", icon="FILEBROWSER")

        # Settings
        col = layout.column(align=True)
        col.prop(settings, "fps")
        col.prop(settings, "frame_start")

        # Track count
        if settings.tracks:
            layout.label(
                text=f"{len(settings.tracks)} tracks loaded",
                icon="ANIM",
            )


# ────────────────────────────────────────────────────────────
# Tracks Sub-panel
# ────────────────────────────────────────────────────────────

class OSCBRIDGE_PT_tracks(bpy.types.Panel):
    bl_label = "Tracks"
    bl_idname = "OSCBRIDGE_PT_tracks"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "OSC Bridge"
    bl_parent_id = "OSCBRIDGE_PT_main"
    bl_options = {"DEFAULT_CLOSED"}

    def draw(self, context):
        layout = self.layout
        settings = context.scene.osc_bridge_settings

        if not settings.tracks:
            layout.label(text="No tracks loaded", icon="INFO")
            return

        # Compact list
        for track in settings.tracks:
            box = layout.box()
            row = box.row(align=True)

            # Track name
            row.label(text=track.name, icon="DRIVER")

            # Event count + range
            sub = row.row(align=True)
            sub.alignment = "RIGHT"
            sub.scale_y = 0.8
            sub.scale_x = 0.8
            sub.label(
                text=f"{track.event_count}ev "
                     f"[{track.min_val:.1f}–{track.max_val:.1f}]",
            )

            # Add mapping button
            op = box.operator(
                "oscbridge.add_mapping",
                text="Map",
                icon="CON_FOLLOWPATH",
            )
            op.track_name = track.name


# ────────────────────────────────────────────────────────────
# Mappings Sub-panel
# ────────────────────────────────────────────────────────────

class OSCBRIDGE_PT_mappings(bpy.types.Panel):
    bl_label = "Mappings"
    bl_idname = "OSCBRIDGE_PT_mappings"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "OSC Bridge"
    bl_parent_id = "OSCBRIDGE_PT_main"

    def draw(self, context):
        layout = self.layout
        settings = context.scene.osc_bridge_settings

        # Action buttons
        row = layout.row(align=True)
        row.operator("oscbridge.bake_all", icon="FCURVE")
        row.operator("oscbridge.clear_baked", text="", icon="X")
        row.operator("oscbridge.clear_mappings", text="", icon="TRASH")

        if not settings.mappings:
            layout.label(text="No mappings yet", icon="INFO")
            layout.label(text="Click 'Map' on a track above", icon="BLANK1")
            return

        # Each mapping
        for i, m in enumerate(settings.mappings):
            self._draw_mapping(layout, context, m, i)

    def _draw_mapping(self, layout, context, m, index):
        box = layout.box()

        # Header: track name + status
        header = box.row(align=True)
        header.label(text=m.track_name, icon="DRIVER")

        status_text = "✓ Baked" if m.baked else "Unbaked"
        status_icon = "CHECKMARK" if m.baked else "REC"
        header.label(text=status_text, icon=status_icon)

        # Remove button
        rm = header.operator(
            "oscbridge.remove_mapping",
            text="",
            icon="X",
        )
        rm.index = index

        # Target property
        col = box.column(align=True)
        col.prop(m, "target_object", text="Object")
        col.prop(m, "target_data_path", text="Path")
        row = col.row(align=True)
        row.prop(m, "target_array_index", text="Index")

        # Input / Output ranges
        box.label(text="Range Mapping:", icon="CON_DISTANCELIMIT")
        grid = box.column(align=True)

        row_in = grid.row(align=True)
        row_in.label(text="In:")
        row_in.prop(m, "in_min", text="Min")
        row_in.prop(m, "in_max", text="Max")

        row_out = grid.row(align=True)
        row_out.label(text="Out:")
        row_out.prop(m, "out_min", text="Min")
        out_col = row_out.row(align=True)
        out_col.prop(m, "out_max", text="Max")

        # Easing + Transition
        row_ease = box.row(align=True)
        row_ease.label(text="Ease:")
        row_ease.prop(m, "easing", text="")
        row_trans = box.row(align=True)
        row_trans.label(text="Time:")
        row_trans.prop(m, "transition", text="")
        row_trans.label(text="s")


# ───────────────────────────────────────────────── /Docs ──────────────────────────────────────

class OSCBRIDGE_PT_docs(bpy.types.Panel):
    bl_label = "Docs"
    bl_idname = "OSCBRIDGE_PT_docs"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "OSC Bridge"
    bl_parent_id = "OSCBRIDGE_PT_main"
    bl_options = {"DEFAULT_CLOSED"}

    def draw(self, context):
        layout = self.layout
        settings = context.scene.osc_bridge_settings

        # Tab selector
        layout.prop(settings, "docs_tab", expand=True)

        if settings.docs_tab == "GUIDE":
            self._draw_guide(layout)
        elif settings.docs_tab == "FORMAT":
            self._draw_format(layout)
        elif settings.docs_tab == "TIPS":
            self._draw_tips(layout)

    def _draw_guide(self, layout):
        """Quick-start guide."""
        steps = [
            ("1.", "Load OSC File",
             "Click the folder icon above to load a .osc score file exported from SuperCollider NRT."),
            ("2.", "Browse Tracks",
             "Open the Tracks panel below to see all detected parameter tracks (e.g. sine.freq, saw.amp)."),
            ("3.", "Create Mappings",
             "Click 'Map' on any track. Set the target object, data path, and array index."),
            ("4.", "Set Ranges",
             "Adjust Input min/max to match the OSC value range. Set Output min/max for the Blender property."),
            ("5.", "Bake",
             "Click 'Bake All F-Curves'. Keyframes are created on the timeline, ready to play."),
        ]
        for num, title, desc in steps:
            box = layout.box()
            box.label(text=f"{num} {title}", icon="DOT")
            # Wrap text label
            lines = _wrap_text(desc, 52)
            for line in lines:
                box.label(text=line, icon="BLANK1")

        layout.separator()
        layout.label(text="Common Data Paths:", icon="NONE")
        paths = [
            "location (0=X, 1=Y, 2=Z)",
            "rotation_euler (0=X, 1=Y, 2=Z)",
            "scale (0=X, 1=Y, 2=Z)",
            "active_material.emit_... [for shaders]",
        ]
        for p in paths:
            layout.label(text=p, icon="BLANK1")

    def _draw_format(self, layout):
        """OSC file format reference."""
        box = layout.box()
        box.label(text="OSC Score Format", icon="TEXT")
        layout.separator()

        fmt = [
            ("Format:", "timestamp /address arg1 arg2 ..."),
            ("", ""),
            ("/s_new", "Create synth: synthname nodeid addaction target params..."),
            ("", "  Example: 0.0 /s_new sine 1000 0 0 freq 440 amp 0.3"),
            ("", ""),
            ("/n_set", "Set node param: nodeid param value [param value...]"),
            ("", "  Example: 1.5 /n_set 1000 freq 880"),
            ("", ""),
            ("/n_free", "Free node: nodeid"),
            ("", "  Example: 2.0 /n_free 1000"),
            ("", ""),
            ("/c_set", "Set control bus: bus value"),
            ("", "  Example: 0.0 /c_set 0 0.5"),
            ("", ""),
            ("/rack/control", "Named control: name value (finite, clamped 0..1)"),
            ("", "  Example: 0.0 /rack/control bloom 0.7"),
            ("", ""),
            ("Timestamps", "Seconds (float). Frame = time × FPS + start_frame"),
            ("Comments", "Lines starting with # are ignored"),
        ]
        for label, desc in fmt:
            row = box.row(align=True)
            if label:
                row.label(text=label, icon="MONKEY")
            else:
                row.label(text="", icon="BLANK1")
            row.label(text=desc)

        layout.separator()
        layout.label(
            text="Generate with SuperCollider:",
            icon="TEXT",
        )
        layout.label(
            text="sclang score.scd → outputs .osc files",
            icon="BLANK1",
        )

    def _draw_tips(self, layout):
        """Tips and tricks."""
        tips = [
            ("Easing: Instant",
             "Percussive hits, light flashes, sudden changes. "
             "No transition time needed — value snaps immediately."),
            ("Easing: Smooth",
             "The workhorse. Natural organic motion. "
             "Good default for rotation, scale, location. "
             "0.15-0.3s transition feels snappy yet smooth."),
            ("Easing: Overshoot",
             "Spring/p settle. Great for mechanical parts, "
             "robotic arms, anything that should feel powered. "
             "Pair with 0.1-0.2s transition."),
            ("Easing: Bounce",
             "Elastic settle. Playful, cartoony. "
             "Use sparingly — needs 0.3s+ to read."),
            ("Easing: Lag",
             "Delayed catch-up. Heavy, sluggish, organic. "
             "Great for fog density, large objects, anything massive."),
            ("Transition Time",
             "How long the easing curve takes. 0.05s = instant, "
             "0.15s = snappy, 0.3s = smooth, 0.5s+ = luxurious."),
            ("Tip: Rotation Mapping",
             "Map freq (220-660) to rotation_euler[2] with output "
             "0-6.283 (full turn). Each note spins the object."),
            ("Tip: Emission Pulse",
             "Map amp (0-0.3) to emission_strength (0-10). "
             "Instant easing for sharp strobes, Smooth for glows."),
            ("Tip: Negative Output",
             "Output ranges can be negative. Map 0-1 to -1 to +1 "
             "for bidirectional control."),
            ("Tip: Multiple Targets",
             "Map the same track to different objects with different "
             "easing. One drives a snappy light, another a smooth motor."),
            ("Tip: Re-baking",
             "Re-baking overwrites keyframes cleanly. "
             "Change easing and re-bake without clearing first."),
        ]

        for title, desc in tips:
            box = layout.box()
            box.label(text=title, icon="LIGHTBULB")
            for line in _wrap_text(desc, 52):
                box.label(text=line, icon="BLANK1")


def _wrap_text(text, width=50):
    """Wrap text into lines of approximately 'width' characters."""
    words = text.split()
    lines = []
    current = ""
    for word in words:
        if len(current) + len(word) + 1 <= width:
            current = (current + " " + word).strip()
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


# Registration
classes = (
    OSCBRIDGE_PT_main,
    OSCBRIDGE_PT_tracks,
    OSCBRIDGE_PT_mappings,
    OSCBRIDGE_PT_docs,
)
