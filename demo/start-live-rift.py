"""Start the bridge and maintain driver updates across object edits and undo/redo."""
import bpy
import osc_score_bridge.live as live
from bpy.app.handlers import persistent

old = bpy.app.driver_namespace.get('rack_demo_refresh')
if old and bpy.app.timers.is_registered(old):
    bpy.app.timers.unregister(old)


def refresh_rift():
    # Never retain Scene/Object RNA references: undo may replace their datablocks.
    try:
        scene = bpy.context.scene
        settings = getattr(scene, 'osc_bridge_settings', None)
        names = {m.target_object for m in settings.mappings} if settings else set()
        for name in names:
            obj = bpy.data.objects.get(name)
            if obj is not None:
                obj.update_tag()
        if names:
            bpy.context.view_layer.update()
        bpy.app.driver_namespace['rack_refresh_error'] = ''
    except (ReferenceError, RuntimeError, AttributeError) as exc:
        bpy.app.driver_namespace['rack_refresh_error'] = str(exc)
    return 1 / 30


@persistent
def restore_rift_refresh(*_args):
    if not bpy.app.timers.is_registered(refresh_rift):
        bpy.app.timers.register(refresh_rift, first_interval=.1, persistent=True)
    bpy.app.driver_namespace['rack_demo_refresh'] = refresh_rift


restore_rift_refresh._rack_rift_handler = True
for handlers in (bpy.app.handlers.undo_post, bpy.app.handlers.redo_post):
    for callback in list(handlers):
        if getattr(callback, '_rack_rift_handler', False):
            handlers.remove(callback)
    handlers.append(restore_rift_refresh)
restore_rift_refresh()
if live._socket is None:
    live.start(57141)
print('OSC refresh active; editing and undo/redo recovery installed.')
