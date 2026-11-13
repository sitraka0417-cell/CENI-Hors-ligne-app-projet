package mg.ceni.horsligne;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Lecture d'un dossier choisi par l'utilisateur (Storage Access Framework) : le dossier reste mémorisé entre les lancements. */
@CapacitorPlugin(name = "CeniFolder")
public class CeniFolderPlugin extends Plugin {
    private static final Pattern IMG = Pattern.compile("\\.(jpe?g|png|webp|gif|bmp|avif)$", Pattern.CASE_INSENSITIVE);

    private SharedPreferences prefs() { return getContext().getSharedPreferences("ceni_folder", Context.MODE_PRIVATE); }

    private Uri tree() { String s = prefs().getString("uri", null); return s == null ? null : Uri.parse(s); }

    private boolean hasPermission(Uri u) {
        for (UriPermission p : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (p.getUri().equals(u) && p.isReadPermission()) return true;
        }
        return false;
    }

    private String nameOf(Uri tree) {
        try {
            Uri d = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            try (Cursor c = getContext().getContentResolver().query(d, new String[]{DocumentsContract.Document.COLUMN_DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst() && c.getString(0) != null) return c.getString(0);
            }
        } catch (Exception e) { /* ignore */ }
        return "dossier";
    }

    @PluginMethod
    public void getFolder(PluginCall call) {
        JSObject r = new JSObject();
        Uri t = tree();
        if (t != null && hasPermission(t)) { r.put("uri", t.toString()); r.put("name", nameOf(t)); }
        call.resolve(r);
    }

    @PluginMethod
    public void pick(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, i, "pickResult");
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            r.put("cancelled", true);
            call.resolve(r);
            return;
        }
        Uri uri = data.getData();
        try {
            Uri old = tree();
            getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (old != null && !old.equals(uri)) {
                try { getContext().getContentResolver().releasePersistableUriPermission(old, Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception e) { /* ignore */ }
            }
        } catch (Exception e) { /* certains fournisseurs ne permettent pas la permission durable */ }
        prefs().edit().putString("uri", uri.toString()).apply();
        r.put("uri", uri.toString());
        r.put("name", nameOf(uri));
        call.resolve(r);
    }

    /** Liste récursive de toutes les images : {p: chemin relatif du dossier, n: nom, id: identifiant, s: taille}. */
    @PluginMethod
    public void scan(final PluginCall call) {
        final Uri t = tree();
        if (t == null || !hasPermission(t)) { call.reject("Aucun dossier choisi (ou autorisation perdue)."); return; }
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    JSArray out = new JSArray();
                    walk(t, DocumentsContract.getTreeDocumentId(t), nameOf(t), 0, out);
                    JSObject r = new JSObject();
                    r.put("name", nameOf(t));
                    r.put("files", out);
                    call.resolve(r);
                } catch (Exception e) {
                    call.reject(String.valueOf(e.getMessage()), e);
                }
            }
        }).start();
    }

    private void walk(Uri tree, String docId, String path, int depth, JSArray out) {
        Uri kids = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId);
        List<String[]> dirs = new ArrayList<>();
        String[] cols = {DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_SIZE};
        try (Cursor c = getContext().getContentResolver().query(kids, cols, null, null, null)) {
            if (c == null) return;
            while (c.moveToNext()) {
                String id = c.getString(0), name = c.getString(1), mime = c.getString(2);
                if (id == null || name == null || name.startsWith(".")) continue;
                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    dirs.add(new String[]{id, name});
                } else if ((mime != null && mime.startsWith("image/")) || IMG.matcher(name).find()) {
                    JSObject o = new JSObject();
                    o.put("p", path);
                    o.put("n", name);
                    o.put("id", id);
                    o.put("s", c.getLong(3));
                    out.put(o);
                }
            }
        }
        if (depth >= 8) return;
        for (String[] d : dirs) walk(tree, d[0], path.isEmpty() ? d[1] : path + "/" + d[1], depth + 1, out);
    }

    /** Lit UN fichier (base64). L'application les demande un par un : mémoire constante, même pour des milliers d'images. */
    @PluginMethod
    public void read(final PluginCall call) {
        final String id = call.getString("id");
        final Uri t = tree();
        if (t == null || id == null) { call.reject("Dossier non défini."); return; }
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    Uri doc = DocumentsContract.buildDocumentUriUsingTree(t, id);
                    try (InputStream in = getContext().getContentResolver().openInputStream(doc)) {
                        if (in == null) throw new java.io.IOException("Lecture impossible");
                        ByteArrayOutputStream bo = new ByteArrayOutputStream(1 << 20);
                        byte[] buf = new byte[65536];
                        int n;
                        while ((n = in.read(buf)) > 0) bo.write(buf, 0, n);
                        JSObject r = new JSObject();
                        r.put("data", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
                        call.resolve(r);
                    }
                } catch (Exception e) {
                    call.reject(String.valueOf(e.getMessage()), e);
                }
            }
        }).start();
    }
}
