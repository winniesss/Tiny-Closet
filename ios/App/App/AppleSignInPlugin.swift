import Foundation
import Capacitor
import AuthenticationServices

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {

    private var savedCall: CAPPluginCall?

    @objc func signIn(_ call: CAPPluginCall) {
        savedCall = call

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self

        DispatchQueue.main.async {
            controller.performRequests()
        }
    }

    @objc func getCredentialState(_ call: CAPPluginCall) {
        guard let userId = call.getString("userId") else {
            call.reject("userId is required")
            return
        }

        let provider = ASAuthorizationAppleIDProvider()
        provider.getCredentialState(forUserID: userId) { state, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }

            switch state {
            case .authorized:
                call.resolve(["state": "authorized"])
            case .revoked:
                call.resolve(["state": "revoked"])
            case .notFound:
                call.resolve(["state": "notFound"])
            case .transferred:
                call.resolve(["state": "transferred"])
            @unknown default:
                call.resolve(["state": "unknown"])
            }
        }
    }

    // MARK: - ASAuthorizationControllerDelegate

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            savedCall?.reject("Invalid credential type")
            savedCall = nil
            return
        }

        var result: [String: Any] = [
            "user": credential.user
        ]

        if let email = credential.email {
            result["email"] = email
        }
        if let fullName = credential.fullName {
            if let givenName = fullName.givenName {
                result["givenName"] = givenName
            }
            if let familyName = fullName.familyName {
                result["familyName"] = familyName
            }
        }
        if let identityToken = credential.identityToken,
           let tokenString = String(data: identityToken, encoding: .utf8) {
            result["identityToken"] = tokenString
        }
        if let authorizationCode = credential.authorizationCode,
           let codeString = String(data: authorizationCode, encoding: .utf8) {
            result["authorizationCode"] = codeString
        }

        savedCall?.resolve(result)
        savedCall = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        if let authError = error as? ASAuthorizationError, authError.code == .canceled {
            savedCall?.reject("USER_CANCELED")
        } else {
            savedCall?.reject(error.localizedDescription)
        }
        savedCall = nil
    }

    // MARK: - ASAuthorizationControllerPresentationContextProviding

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.webView?.window ?? UIWindow()
    }
}
