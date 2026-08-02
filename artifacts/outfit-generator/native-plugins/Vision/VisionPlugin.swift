import Foundation
import Capacitor
import Vision
import UIKit

/// VisionPlugin — runs VNClassifyImageRequest + VNRecognizeTextRequest on a
/// background queue and returns labels and recognized text to the web layer.
/// Falls back silently to empty arrays on any error.
@objc(VisionPlugin)
public class VisionPlugin: CAPPlugin {

    @objc func analyze(_ call: CAPPluginCall) {
        guard
            let dataUrl  = call.getString("dataUrl"),
            let comma    = dataUrl.firstIndex(of: ",")
        else {
            call.resolve(["labels": [] as [String], "text": [] as [String]])
            return
        }

        let base64 = String(dataUrl[dataUrl.index(after: comma)...])
        guard
            let imageData = Data(base64Encoded: base64, options: .ignoreUnknownCharacters),
            let uiImage   = UIImage(data: imageData),
            let cgImage   = uiImage.cgImage
        else {
            call.resolve(["labels": [] as [String], "text": [] as [String]])
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            var labels: [String]        = []
            var recognizedText: [String] = []

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])

            // Image classification (confidence threshold 0.3)
            let classifyReq = VNClassifyImageRequest()
            do {
                try handler.perform([classifyReq])
                labels = (classifyReq.results ?? [])
                    .filter { $0.confidence >= 0.3 }
                    .map    { $0.identifier }
            } catch { /* fall through */ }

            // Text recognition (accurate mode)
            let textReq = VNRecognizeTextRequest()
            textReq.recognitionLevel = .accurate
            do {
                try handler.perform([textReq])
                recognizedText = (textReq.results ?? [])
                    .compactMap { $0.topCandidates(1).first?.string }
            } catch { /* fall through */ }

            DispatchQueue.main.async {
                call.resolve(["labels": labels, "text": recognizedText])
            }
        }
    }
}
