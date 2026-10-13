import UIKit
import Capacitor

class GameViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameNotificationsPlugin())
        // CSS env(safe-area-inset-*) owns the notch/home-indicator padding.
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.bounces = false
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
