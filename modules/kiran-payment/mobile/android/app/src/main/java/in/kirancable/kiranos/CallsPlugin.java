package in.kirancable.kiranos;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.os.Build;
import android.os.PowerManager;
import android.view.WindowManager;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.List;

/**
 * What a call needs from Android that the web view cannot do on its own:
 * which speaker the voice comes out of, the screen going dark against your
 * ear, ringing from the notification shade while the app is not on screen,
 * and staying on a call when you switch to another app (CallService).
 *
 * The web side is src/calls/native.ts. The call itself — the microphone, the
 * camera and the connection — is WebRTC in the web view.
 */
@CapacitorPlugin(
    name = "KiranCalls",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class CallsPlugin extends Plugin {

    static final String CHANNEL_INCOMING = "calls_incoming";
    static final String CHANNEL_ONGOING = "calls_ongoing";
    private static final int INCOMING_ID = 7101;

    /** Where the voice goes when the loudspeaker is off: a headset if there is one, else the earpiece. */
    private static final int[] PRIVATE_OUTPUTS = {
        AudioDeviceInfo.TYPE_WIRED_HEADSET,
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_USB_HEADSET,
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
        AudioDeviceInfo.TYPE_BLE_HEADSET,
        AudioDeviceInfo.TYPE_BUILTIN_EARPIECE,
    };

    private PowerManager.WakeLock proximity;
    private boolean inCall = false;

    @Override
    public void load() {
        createChannels(getContext());
    }

    static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel incoming = new NotificationChannel(
            CHANNEL_INCOMING,
            "Incoming calls",
            NotificationManager.IMPORTANCE_HIGH
        );
        incoming.setDescription("Rings when someone calls you while KiranOS is not on screen.");
        AudioAttributes ringtone = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        incoming.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE), ringtone);
        incoming.enableVibration(true);
        incoming.setVibrationPattern(new long[] { 0, 900, 1500 });
        incoming.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(incoming);

        NotificationChannel ongoing = new NotificationChannel(
            CHANNEL_ONGOING,
            "Ongoing calls",
            NotificationManager.IMPORTANCE_LOW
        );
        ongoing.setDescription("Shows while you are on a call, so it carries on in the background.");
        ongoing.setSound(null, null);
        manager.createNotificationChannel(ongoing);
    }

    /* ------------------------------------------------------------ audio */

    @PluginMethod
    public void setSpeaker(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audio != null) route(audio, on);
        call.resolve();
    }

    private static void route(AudioManager audio, boolean speaker) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            List<AudioDeviceInfo> devices = audio.getAvailableCommunicationDevices();
            AudioDeviceInfo target = null;
            if (speaker) {
                target = find(devices, AudioDeviceInfo.TYPE_BUILTIN_SPEAKER);
            } else {
                for (int type : PRIVATE_OUTPUTS) {
                    target = find(devices, type);
                    if (target != null) break;
                }
            }
            if (target != null) {
                audio.setCommunicationDevice(target);
            } else {
                audio.clearCommunicationDevice();
            }
        } else {
            audio.setSpeakerphoneOn(speaker);
        }
    }

    private static AudioDeviceInfo find(List<AudioDeviceInfo> devices, int type) {
        for (AudioDeviceInfo device : devices) {
            if (device.getType() == type) return device;
        }
        return null;
    }

    /* ----------------------------------------------------------- screen */

    @PluginMethod
    public void setInCall(PluginCall call) {
        boolean active = Boolean.TRUE.equals(call.getBoolean("active", false));
        boolean nearEar = Boolean.TRUE.equals(call.getBoolean("proximity", false));
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            if (active) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            showOverLockScreen(activity, active);
        });
        setProximity(active && nearEar);
        if (inCall && !active) {
            // Hand the audio route back to whatever comes next.
            AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (audio != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    audio.clearCommunicationDevice();
                } else {
                    audio.setSpeakerphoneOn(false);
                }
            }
        }
        inCall = active;
        call.resolve();
    }

    /** Turns the screen off while the phone is held to an ear, so a cheek cannot end the call. */
    private void setProximity(boolean on) {
        PowerManager power = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        if (power == null) return;
        if (on) {
            if (!power.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) return;
            if (proximity == null) {
                proximity = power.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "kiranos:call");
            }
            if (!proximity.isHeld()) proximity.acquire(4 * 60 * 60 * 1000L);
        } else if (proximity != null && proximity.isHeld()) {
            proximity.release(PowerManager.RELEASE_FLAG_WAIT_FOR_NO_PROXIMITY);
        }
    }

    @SuppressWarnings("deprecation")
    private static void showOverLockScreen(Activity activity, boolean show) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            activity.setShowWhenLocked(show);
            activity.setTurnScreenOn(show);
        } else {
            int flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON;
            if (show) {
                activity.getWindow().addFlags(flags);
            } else {
                activity.getWindow().clearFlags(flags);
            }
        }
    }

    /* ---------------------------------------------------- incoming call */

    @PluginMethod
    public void showIncoming(PluginCall call) {
        Context context = getContext();
        if (!canNotify(context)) {
            call.resolve();
            return;
        }
        PendingIntent open = PendingIntent.getActivity(
            context,
            0,
            openApp(context),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification notification = new NotificationCompat.Builder(context, CHANNEL_INCOMING)
            .setSmallIcon(R.drawable.ic_call_notification)
            .setContentTitle(call.getString("title", "Incoming call"))
            .setContentText(call.getString("body", ""))
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(true)
            .setContentIntent(open)
            .setFullScreenIntent(open, true)
            .setTimeoutAfter(60_000)
            .build();
        // Ring until answered or cancelled, not once.
        notification.flags |= Notification.FLAG_INSISTENT;
        try {
            NotificationManagerCompat.from(context).notify(INCOMING_ID, notification);
        } catch (SecurityException refused) {
            // Notifications were turned off in the meantime: the call still rings in the app.
        }
        Activity activity = getActivity();
        activity.runOnUiThread(() -> showOverLockScreen(activity, true));
        call.resolve();
    }

    @PluginMethod
    public void clearIncoming(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(INCOMING_ID);
        Activity activity = getActivity();
        activity.runOnUiThread(() -> showOverLockScreen(activity, inCall));
        call.resolve();
    }

    static Intent openApp(Context context) {
        return new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    }

    private static boolean canNotify(Context context) {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return false;
        }
        return NotificationManagerCompat.from(context).areNotificationsEnabled();
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || getPermissionState("notifications") == PermissionState.GRANTED) {
            answer(call, true);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsAnswered");
    }

    @PermissionCallback
    private void notificationsAnswered(PluginCall call) {
        answer(call, getPermissionState("notifications") == PermissionState.GRANTED);
    }

    private static void answer(PluginCall call, boolean granted) {
        JSObject result = new JSObject();
        result.put("granted", granted);
        call.resolve(result);
    }

    /* ----------------------------------------------------- ongoing call */

    @PluginMethod
    public void startOngoing(PluginCall call) {
        Context context = getContext();
        Intent intent = new Intent(context, CallService.class)
            .putExtra(CallService.EXTRA_TITLE, call.getString("title", ""))
            .putExtra(CallService.EXTRA_VIDEO, Boolean.TRUE.equals(call.getBoolean("video", false)));
        try {
            ContextCompat.startForegroundService(context, intent);
            call.resolve();
        } catch (RuntimeException refused) {
            // Android 12 and later refuse this to an app that is not on screen.
            call.reject("The call cannot carry on in the background.", refused);
        }
    }

    @PluginMethod
    public void stopOngoing(PluginCall call) {
        getContext().stopService(new Intent(getContext(), CallService.class));
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        setProximity(false);
        getContext().stopService(new Intent(getContext(), CallService.class));
        NotificationManagerCompat.from(getContext()).cancel(INCOMING_ID);
    }
}
