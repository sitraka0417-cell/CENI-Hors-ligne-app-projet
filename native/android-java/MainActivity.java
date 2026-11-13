package mg.ceni.horsligne;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CeniFolderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
