#import <Capacitor/Capacitor.h>

CAP_PLUGIN(ImageCropPlugin, "ImageCropPlugin",
    CAP_PLUGIN_METHOD(pickAndCrop, CAPPluginReturnPromise);
)
