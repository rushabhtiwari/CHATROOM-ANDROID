package in.kirancable.kiranos;

import android.Manifest;
import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

/**
 * Keeps a call going when the app leaves the screen.
 *
 * Android silences the microphone and closes the camera of an app in the
 * background — unless the app is running a foreground service that says it
 * is using them. This is that service: it does nothing but hold the "on a
 * call" notification for as long as the call lasts (CallsPlugin starts and
 * stops it), which is what lets you switch apps, or lock the phone, mid-call.
 */
public class CallService extends Service {

    static final String EXTRA_TITLE = "title";
    static final String EXTRA_VIDEO = "video";
    private static final int ONGOING_ID = 7102;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        CallsPlugin.createChannels(this);
        String name = intent != null ? intent.getStringExtra(EXTRA_TITLE) : null;
        boolean video = intent != null && intent.getBooleanExtra(EXTRA_VIDEO, false);

        PendingIntent open = PendingIntent.getActivity(
            this,
            1,
            CallsPlugin.openApp(this),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification notification = new NotificationCompat.Builder(this, CallsPlugin.CHANNEL_ONGOING)
            .setSmallIcon(R.drawable.ic_call_notification)
            .setContentTitle(name == null || name.isEmpty() ? "KiranOS call" : name)
            .setContentText(video ? "Video call · tap to go back to it" : "Voice call · tap to go back to it")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setUsesChronometer(true)
            .setContentIntent(open)
            .build();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                int types = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                if (video && granted(Manifest.permission.CAMERA)) {
                    types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
                }
                startForeground(ONGOING_ID, notification, types);
            } else {
                startForeground(ONGOING_ID, notification);
            }
        } catch (RuntimeException refused) {
            // Not allowed now: the microphone permission is missing, or the app
            // had already left the screen. The call carries on while it is open.
            stopSelf();
        }
        return START_NOT_STICKY;
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
