import java.io.*;
import java.security.KeyStore;
import java.util.*;

/** Retrouve le mot de passe de la clé d'upload à partir d'un mot de passe proche
 *  (faute de frappe, majuscule, touche doublée ou oubliée, lettres inversées).
 *  Le mot de passe est lu sur l'entrée standard ; s'il est retrouvé, il est rangé
 *  dans le trousseau macOS et n'est jamais affiché. */
public class RecoverKeyPassword {
  static byte[] ks;
  static boolean opens(String p) {
    try { KeyStore k = KeyStore.getInstance("PKCS12"); k.load(new ByteArrayInputStream(ks), p.toCharArray()); return true; }
    catch (Exception e) { return false; }
  }
  static String toggle(String s) {
    StringBuilder b = new StringBuilder();
    for (char c : s.toCharArray()) b.append(Character.isUpperCase(c) ? Character.toLowerCase(c) : Character.toUpperCase(c));
    return b.toString();
  }
  public static void main(String[] a) throws Exception {
    ks = java.nio.file.Files.readAllBytes(new File(a[0]).toPath());
    String base = new BufferedReader(new InputStreamReader(System.in)).readLine();
    if (base == null) base = "";
    base = base.strip();
    String chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789&é\"'(§è!çà)-_@#$%*+=/.,;:?<>[]{}^`~|\\ €£ùÉÈÀÇ";
    LinkedHashMap<String,String> cand = new LinkedHashMap<>();
    List<String> bases = new ArrayList<>(List.of(base, toggle(base)));
    if (!base.isEmpty()) {
      bases.add(Character.toUpperCase(base.charAt(0)) + base.substring(1));
      bases.add(Character.toLowerCase(base.charAt(0)) + base.substring(1));
    }
    String[] labels = {"identique", "majuscules inversées (verr. maj.)", "première lettre en majuscule", "première lettre en minuscule"};
    for (int bi = 0; bi < bases.size(); bi++) {
      String s = bases.get(bi), lb = labels[bi];
      cand.putIfAbsent(s, lb);
      for (int i = 0; i < s.length(); i++) cand.putIfAbsent(s.substring(0,i) + s.substring(i+1), lb + " + une lettre oubliée (position " + (i+1) + ")");
      for (int i = 0; i < s.length(); i++) cand.putIfAbsent(s.substring(0,i+1) + s.charAt(i) + s.substring(i+1), lb + " + une touche doublée (position " + (i+1) + ")");
      for (int i = 0; i + 1 < s.length(); i++) cand.putIfAbsent(s.substring(0,i) + s.charAt(i+1) + s.charAt(i) + s.substring(i+2), lb + " + deux lettres inversées (positions " + (i+1) + "-" + (i+2) + ")");
      for (int i = 0; i < s.length(); i++) {
        char c = s.charAt(i);
        cand.putIfAbsent(s.substring(0,i) + (Character.isUpperCase(c) ? Character.toLowerCase(c) : Character.toUpperCase(c)) + s.substring(i+1), lb + " + majuscule/minuscule (position " + (i+1) + ")");
      }
    }
    // Faute de frappe sur une lettre, ou lettre en trop (mot de passe exact uniquement)
    for (int i = 0; i < base.length(); i++) for (char c : chars.toCharArray())
      cand.putIfAbsent(base.substring(0,i) + c + base.substring(i+1), "une lettre différente (position " + (i+1) + ")");
    for (int i = 0; i <= base.length(); i++) for (char c : chars.toCharArray())
      cand.putIfAbsent(base.substring(0,i) + c + base.substring(i), "une lettre en trop (position " + (i+1) + ")");
    System.out.println("Essai de " + cand.size() + " variantes…");
    int n = 0;
    for (Map.Entry<String,String> e : cand.entrySet()) {
      if (++n % 500 == 0) System.out.println("  " + n + " / " + cand.size());
      if (opens(e.getKey())) {
        Process p = new ProcessBuilder("security", "add-generic-password", "-U", "-s", "NBgAmes Android upload key", "-a", "upload", "-w", e.getKey()).inheritIO().start();
        p.waitFor();
        System.out.println("\n✅ TROUVÉ ! Différence avec ton mot de passe enregistré : " + e.getValue());
        System.out.println("   Le bon mot de passe est rangé dans le trousseau du Mac (« NBgAmes Android upload key »).");
        System.out.println("   Le script de fabrication l'utilisera tout seul : relance build-release.sh.");
        System.exit(0);
      }
    }
    System.out.println("\n❌ Aucune variante proche ne fonctionne.");
    System.exit(1);
  }
}
