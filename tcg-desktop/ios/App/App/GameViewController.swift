import UIKit
import Capacitor

class GameViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameNotificationsPlugin())
        // CSS env(safe-area-inset-*) owns the notch/home-indicator padding.
        webView?.scrollView.contentInsetAdjustmentBehavior = .never
        webView?.scrollView.bounces = false
    }

    // The web shell draws a dark strip behind the iOS status bar on every screen.
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
}
