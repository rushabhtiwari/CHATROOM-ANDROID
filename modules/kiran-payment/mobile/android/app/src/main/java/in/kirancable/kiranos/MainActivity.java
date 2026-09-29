package in.kirancable.kiranos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin, for calls. Registered before the bridge is
        // created, which is when it loads its plugins.
        registerPlugin(CallsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
