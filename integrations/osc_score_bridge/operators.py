"""
OSC Score Bridge — Operators
Load OSC files, add/remove mappings, bake/clear F-Curves.
"""

import bpy
from bpy.props import StringProperty, IntProperty
from bpy_extras.io_utils import ImportHelper

from . import parser as osc_parser
from . import baker


class OSCBRIDGE_OT_load_file(bpy.types.Operator, ImportHelper):
    """Load an OSC score file and extract parameter tracks."""

    bl_idname = "oscbridge.load_file"
    bl_label = "Load OSC File"
    bl_options = {"REGISTER"}

    # ImportHelper
    filename_ext = ".osc"
    filter_glob: StringProperty(
        default="*.osc;*.txt",
        options={"HIDDEN"},
    )

    def execute(self, context):
        settings = context.scene.osc_bridge_settings

        # Parse the file
        try:
            tracks = osc_parser.parse_osc_file(self.filepath)
        except Exception as e:
            self.report({"ERROR"}, f"Parse error: {e}")
            return {"CANCELLED"}

        if not tracks:
            self.report({"WARNING"}, "No tracks found in file")
            return {"CANCELLED"}

        # Store file path
        settings.osc_file = self.filepath

        # Clear old tracks
        settings.tracks.clear()

        # Populate tracks
        summaries = osc_parser.get_track_summary(tracks)
        for s in summaries:
            entry = settings.tracks.add()
            entry.name = s["name"]
            entry.event_count = s["event_count"]
            entry.min_val = s["min_val"]
            entry.max_val = s["max_val"]
            entry.duration = s["duration"]

        count = len(summaries)
        self.report({"INFO"}, f"Loaded {count} tracks from OSC file")
        return {"FINISHED"}


class OSCBRIDGE_OT_add_mapping(bpy.types.Operator):
    """Add a new OSC-to-property mapping."""

    bl_idname = "oscbridge.add_mapping"
    bl_label = "Add Mapping"
    bl_options = {"REGISTER", "UNDO"}

    track_name: StringProperty(
        name="Track",
        description="OSC track name",
    )

    def execute(self, context):
        settings = context.scene.osc_bridge_settings
        if not self.track_name:
            self.report({"ERROR"}, "No track/control selected")
            return {"CANCELLED"}

        m = settings.mappings.add()
        m.name = f"{self.track_name} → (unassigned)"
        m.track_name = self.track_name

        # Auto-fill input range from track data
        for track in settings.tracks:
            if track.name == self.track_name:
                m.in_min = track.min_val
                m.in_max = track.max_val
                break

        settings.mapping_index = len(settings.mappings) - 1

        # Also try to fill target from active object
        obj = context.active_object
        if obj:
            m.target_object = obj.name

        self.report({"INFO"}, f"Added mapping for '{self.track_name}'")
        return {"FINISHED"}

    @classmethod
    def poll(cls, context):
        return True


class OSCBRIDGE_OT_remove_mapping(bpy.types.Operator):
    """Remove the selected mapping."""

    bl_idname = "oscbridge.remove_mapping"
    bl_label = "Remove Mapping"
    bl_options = {"REGISTER", "UNDO"}

    index: IntProperty(name="Index", default=0)

    def execute(self, context):
        settings = context.scene.osc_bridge_settings
        if self.index < len(settings.mappings):
            settings.mappings.remove(self.index)
            if settings.mapping_index >= len(settings.mappings):
                settings.mapping_index = max(
                    0, len(settings.mappings) - 1
                )
        return {"FINISHED"}


class OSCBRIDGE_OT_bake_all(bpy.types.Operator):
    """Bake all mappings into F-Curves."""

    bl_idname = "oscbridge.bake_all"
    bl_label = "Bake All F-Curves"
    bl_options = {"REGISTER"}

    def execute(self, context):
        scene = context.scene
        settings = scene.osc_bridge_settings

        if not settings.mappings:
            self.report({"ERROR"}, "No mappings to bake")
            return {"CANCELLED"}

        if not settings.osc_file:
            self.report({"ERROR"}, "No OSC file loaded")
            return {"CANCELLED"}

        baked_count, errors = baker.bake_mappings(scene)

        msg = f"Baked {baked_count} mapping(s)"
        if errors:
            msg += f", {len(errors)} error(s)"
            for e in errors[:3]:
                msg += f"\n  • {e}"
            if len(errors) > 3:
                msg += f"\n  ...and {len(errors) - 3} more"

        self.report({"INFO"}, msg)
        return {"FINISHED"}


class OSCBRIDGE_OT_clear_baked(bpy.types.Operator):
    """Remove all baked F-Curves for OSC mappings."""

    bl_idname = "oscbridge.clear_baked"
    bl_label = "Clear Baked F-Curves"
    bl_options = {"REGISTER"}

    def execute(self, context):
        scene = context.scene
        removed = baker.clear_baked(scene)

        self.report(
            {"INFO"},
            f"Cleared {removed} baked F-Curve(s)"
        )
        return {"FINISHED"}


class OSCBRIDGE_OT_clear_mappings(bpy.types.Operator):
    """Remove all mappings."""

    bl_idname = "oscbridge.clear_mappings"
    bl_label = "Clear All Mappings"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        context.scene.osc_bridge_settings.mappings.clear()
        return {"FINISHED"}


# Register classes
classes = (
    OSCBRIDGE_OT_load_file,
    OSCBRIDGE_OT_add_mapping,
    OSCBRIDGE_OT_remove_mapping,
    OSCBRIDGE_OT_bake_all,
    OSCBRIDGE_OT_clear_baked,
    OSCBRIDGE_OT_clear_mappings,
)
