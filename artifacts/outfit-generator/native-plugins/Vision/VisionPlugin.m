#import <Capacitor/Capacitor.h>

CAP_PLUGIN(VisionPlugin, "VisionPlugin",
    CAP_PLUGIN_METHOD(analyze, CAPPluginReturnPromise);
)
