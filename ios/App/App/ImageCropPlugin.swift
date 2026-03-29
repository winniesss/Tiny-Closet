import Foundation
import Capacitor
import UIKit

@objc(ImageCropPlugin)
public class ImageCropPlugin: CAPPlugin, UIImagePickerControllerDelegate, UINavigationControllerDelegate {

    private var savedCall: CAPPluginCall?

    @objc func pickAndCrop(_ call: CAPPluginCall) {
        savedCall = call

        DispatchQueue.main.async {
            let picker = UIImagePickerController()
            picker.sourceType = .photoLibrary
            picker.allowsEditing = true
            picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    // MARK: - UIImagePickerControllerDelegate

    public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        picker.dismiss(animated: true)

        // Use the edited (cropped) image if available, otherwise the original
        let image = (info[.editedImage] as? UIImage) ?? (info[.originalImage] as? UIImage)

        guard let finalImage = image else {
            savedCall?.reject("No image selected")
            savedCall = nil
            return
        }

        // Resize if too large (max 800px on longest side)
        let maxDim: CGFloat = 800
        let resized: UIImage
        if finalImage.size.width > maxDim || finalImage.size.height > maxDim {
            let ratio = maxDim / max(finalImage.size.width, finalImage.size.height)
            let newSize = CGSize(width: finalImage.size.width * ratio, height: finalImage.size.height * ratio)
            UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
            finalImage.draw(in: CGRect(origin: .zero, size: newSize))
            resized = UIGraphicsGetImageFromCurrentImageContext() ?? finalImage
            UIGraphicsEndImageContext()
        } else {
            resized = finalImage
        }

        // Convert to JPEG base64
        guard let data = resized.jpegData(compressionQuality: 0.85) else {
            savedCall?.reject("Failed to encode image")
            savedCall = nil
            return
        }

        let base64 = "data:image/jpeg;base64," + data.base64EncodedString()
        savedCall?.resolve(["image": base64])
        savedCall = nil
    }

    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        savedCall?.reject("USER_CANCELED")
        savedCall = nil
    }
}
