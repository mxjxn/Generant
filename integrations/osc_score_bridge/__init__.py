"""
OSC Score Bridge
================
A Blender addon that reads SuperCollider NRT OSC score files
and maps audio parameter tracks to any animatable Blender property
with customizable range mapping.

Usage:
    1. Load a .osc score file (from SuperCollider NRT export)
    2. Browse detected tracks in the N-panel
    3. Map tracks to object properties with custom ranges
    4. Bake to generate F-Curves on the timeline

N-Panel location: View3D > Sidebar (N) > "OSC Bridge" tab
"""

bl_info = {
    "name": "OSC Score Bridge",
    "author": "Mx Jxn + Hermes",
    "version": (1, 2, 0),
    "blender": (4, 2, 0),
    "location": "View3D > Sidebar (N) > OSC Bridge",
    "description": "Monitor live musical OSC and map recorded scores to Blender animation",
    "category": "Animation",
}

import bpy

from . import properties
from . import operators
from . import ui
from . import cues
from . import live
from . import performance_scene

# Combine all classes from submodules
classes = (
    properties.OSCBridgeTrack,
    properties.OSCBridgeMapping,
    properties.OSCBridgeSettings,
    live.OSCBRIDGE_OT_live_toggle,
    live.OSCBRIDGE_OT_demo_rig,
    live.OSCBRIDGE_OT_transport_reset,
    performance_scene.OSCBRIDGE_OT_build_performance_scene,
    performance_scene.OSCBRIDGE_OT_bake_performance_scene,
    operators.OSCBRIDGE_OT_load_file,
    operators.OSCBRIDGE_OT_add_mapping,
    operators.OSCBRIDGE_OT_remove_mapping,
    operators.OSCBRIDGE_OT_bake_all,
    operators.OSCBRIDGE_OT_clear_baked,
    operators.OSCBRIDGE_OT_clear_mappings,
    ui.OSCBRIDGE_PT_main,
    live.OSCBRIDGE_PT_live,
    ui.OSCBRIDGE_PT_tracks,
    ui.OSCBRIDGE_PT_mappings,
    ui.OSCBRIDGE_PT_docs,
)


def register():
    cues.register()
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.osc_bridge_settings = bpy.props.PointerProperty(
        type=properties.OSCBridgeSettings
    )


def unregister():
    cues.unregister()
    live.stop()
    performance_scene.remove_frame_handler()
    del bpy.types.Scene.osc_bridge_settings
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
