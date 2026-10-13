#!/usr/bin/env python3
"""Generate, sign, and verify the `Meeting Mode v2` Shortcut (Mission Control plugin).

Spec: docs/superpowers/specs/2026-10-12-quick-config-picker-design.md
Run with `python3 -I`. Python 3 stdlib only.
"""
import copy, os, plistlib, shutil, sqlite3, subprocess, sys, tempfile, urllib.parse, uuid

DIR = '"$HOME/Library/Application Support/Mission Control"'
SENTINEL = "__MC_PICK__"  # ponytail: a Quick Config literally named this would be treated as "nothing saved"

# Fills `names` with SoundSource's Quick Config names (empty if the plist is missing or unreadable).
NAMES = '''f="$HOME/Library/Application Support/SoundSource/Presets.v2.plist"
names=()
g=0; while u=$(plutil -extract $g.uuid raw "$f" 2>/dev/null); do
  if [ "$u" = Configs ]; then i=0; while n=$(plutil -extract $g.presets.$i.name raw "$f" 2>/dev/null); do names+=("$n"); i=$((i+1)); done; fi
  g=$((g+1)); done'''

# stdin: exactly one of meeting | normal | reset meeting | reset normal (no trailing newline;
# anything else, a trailing newline included, exits 2 before touching any file).
# Prints the saved Quick Config name for the mode, or the sentinel when none is saved or the
# saved name is no longer in SoundSource's list (a stale name would make SoundSource show its own
# picker; the stale file stays until SAVE overwrites it). `(Ie)` is an exact, literal element test.
RESOLVE = f'''d={DIR}
in=$(cat; printf x); in=${{in%x}}
mode=${{in#reset }}
case $mode in meeting|normal) ;; *) print -u2 "Mission Control: unexpected input [$in]"; exit 2;; esac
[ "$in" != "$mode" ] && rm -f "$d/meeting-config" "$d/normal-config"
saved=$(cat "$d/$mode-config" 2>/dev/null)
if [ -n "$saved" ]; then
{NAMES}
  (( ${{names[(Ie)$saved]}} )) || saved=
fi
if [ -n "$saved" ]; then printf '%s' "$saved"; else printf '%s' {SENTINEL}; fi'''

# Prints SoundSource's Quick Config names, newline-separated, no trailing newline.
LIST = NAMES + '''
printf '%s' "${(F)names}"'''

# stdin: line 1 = the Shortcut input, rest = the picked name. The name arrives on stdin,
# never in the command string, so apostrophes and quotes are safe.
SAVE = f'''d={DIR}
IFS= read -r in
pick=$(cat)
mode=${{in#reset }}
case $mode in meeting|normal) ;; *) print -u2 "Mission Control: unexpected input [$in]"; exit 2;; esac
mkdir -p "$d"
printf '%s' "$pick" > "$d/$mode-config"
printf '%s' "$pick"'''


def sh(script, stdin, home):
    r = subprocess.run(["/bin/zsh", "-c", script], input=stdin, capture_output=True, text=True,
                       env={"HOME": home, "PATH": "/usr/bin:/bin"})
    return r.returncode, r.stdout


def selftest():
    home = tempfile.mkdtemp()
    try:
        _selftest_shell(home)
        _selftest_compare()
    finally:
        shutil.rmtree(home)
    print("selftest: ok")


def _selftest_shell(home):
    d = os.path.join(home, "Library/Application Support/Mission Control")
    cfg = lambda m: os.path.join(d, f"{m}-config")
    name = 'Bob\'s "HiFi" Mix'
    # Fixture: the Configs group holds every name saved below that must read back; "Other" must be ignored.
    configs = [name, "HiFi Club", "Headphones", "Bob's Mix", "AB", "[Live]"]
    ss = os.path.join(home, "Library/Application Support/SoundSource")
    plist = os.path.join(ss, "Presets.v2.plist")
    os.makedirs(ss)
    with open(plist, "wb") as f:
        plistlib.dump([{"uuid": "Other", "presets": [{"name": "X"}]},
                       {"uuid": "Configs", "presets": [{"name": n} for n in configs]}], f)
    assert sh(LIST, "", home) == (0, "\n".join(configs)), "LIST reads only the Configs group"
    assert sh(RESOLVE, "meeting", home) == (0, SENTINEL), "nothing saved -> sentinel"
    assert sh(SAVE, "meeting\n" + name, home) == (0, name), "save echoes the pick"
    assert open(cfg("meeting")).read() == name, "file is byte-exact"
    assert sh(RESOLVE, "meeting", home) == (0, name), "saved pick read back exactly"
    assert sh(RESOLVE, "normal", home) == (0, SENTINEL), "modes are independent"
    assert sh(SAVE, "normal\nHiFi Club", home) == (0, "HiFi Club")
    assert sh(RESOLVE, "reset normal", home) == (0, SENTINEL), "reset prompts for current mode"
    assert not os.path.exists(cfg("meeting")), "reset clears BOTH picks"
    assert sh(SAVE, "reset meeting\nHeadphones", home) == (0, "Headphones"), "reset input saves to the mode"
    assert open(cfg("meeting")).read() == "Headphones"
    assert sh(SAVE, "normal\nHiFi Club", home) == (0, "HiFi Club")
    # Bad input exits 2 and leaves both saved picks (and the directory) untouched.
    for bad in ["", "bogus", "reset", "reset  meeting", "reset bogus", "meeting\n", "normal\n", "reset meeting\n"]:
        assert sh(RESOLVE, bad, home)[0] == 2, f"unexpected input {bad!r} -> exit 2"
    for bad in ["", "bogus\nX", "reset bogus\nX", "reset  meeting\nX"]:
        assert sh(SAVE, bad, home)[0] == 2, f"SAVE with {bad!r} -> exit 2"
    assert sorted(os.listdir(d)) == ["meeting-config", "normal-config"], "bad input wrote nothing"
    assert open(cfg("meeting")).read() == "Headphones" and open(cfg("normal")).read() == "HiFi Club", \
        "bad input kept both picks"
    # A saved name missing from SoundSource's live list is stale: sentinel, file left untouched.
    # Match is exact and literal: no prefix, glob, or other-group matches.
    for stale in ["No Such Config", "Bob", "A*", "A?", "*", "[AB]", "X", "bob's mix", "Bob's Mix "]:
        assert sh(SAVE, "normal\n" + stale, home) == (0, stale)
        assert sh(RESOLVE, "normal", home) == (0, SENTINEL), f"stale {stale!r} -> sentinel"
        assert open(cfg("normal")).read() == stale, f"stale {stale!r} left in place for SAVE to overwrite"
    for live in ["[Live]", "Bob's Mix", "AB"]:
        assert sh(SAVE, "normal\n" + live, home) == (0, live)
        assert sh(RESOLVE, "normal", home) == (0, live), f"live {live!r} printed exactly"
    # No plist: the list is empty, so any saved name is stale.
    os.remove(plist)
    assert sh(RESOLVE, "normal", home) == (0, SENTINEL), "no plist -> sentinel"
    assert sh(RESOLVE, "meeting", home) == (0, SENTINEL), "no plist -> sentinel (other mode)"


def _selftest_compare():
    want = build()["WFWorkflowActions"]
    assert all(ok for ok, *_ in compare(want, build()["WFWorkflowActions"])), "fresh UUIDs must still match"
    def broken(mutate):
        got = copy.deepcopy(want)
        mutate(got)
        return not all(ok for ok, *_ in compare(want, got))
    P = lambda got, i: got[i]["WFWorkflowActionParameters"]
    assert broken(lambda g: P(g, 4)["WFInput"]["Value"].update(OutputUUID=P(g, 0)["UUID"])), "rewired OutputUUID"
    assert broken(lambda g: P(g, 4)["WFChooseFromListActionPrompt"]["Value"]["attachmentsByRange"].popitem()), \
        "dropped attachmentsByRange entry"
    assert broken(lambda g: P(g, 1).update(WFCondition=5)), "changed WFCondition"
    assert broken(lambda g: P(g, 2).update(Script="true")), "changed Script"
    assert not broken(lambda g: P(g, 2).update(Extra=1)), "extra imported keys are allowed"


U = lambda: str(uuid.uuid4()).upper()
STR = [{"Type": "WFCoercionVariableAggrandizement", "CoercionItemClass": "WFStringContentItem"}]
EXT = {"Type": "ExtensionInput", "Aggrandizements": STR}
SETCONFIG = {"TeamIdentifier": "7266XEXAPM", "BundleIdentifier": "com.rogueamoeba.soundsource",
             "Name": "SoundSource", "AppIntentIdentifier": "SetConfig"}
# Copied from the existing Meeting Mode Shortcut (ZINPUTCLASSESDATA): accept every input type.
INPUT_CLASSES = ["WFAppContentItem", "WFAppStoreAppContentItem", "WFArticleContentItem",
                 "WFContactContentItem", "WFDateContentItem", "WFEmailAddressContentItem",
                 "WFFolderContentItem", "WFGenericFileContentItem", "WFImageContentItem",
                 "WFiTunesProductContentItem", "WFLocationContentItem", "WFDCMapsLinkContentItem",
                 "WFAVAssetContentItem", "WFPDFContentItem", "WFPhoneNumberContentItem",
                 "WFRichTextContentItem", "WFSafariWebPageContentItem", "WFStringContentItem",
                 "WFURLContentItem"]


def out(uid, name):
    return {"OutputUUID": uid, "Type": "ActionOutput", "OutputName": name}


def attach(var):
    return {"Value": var, "WFSerializationType": "WFTextTokenAttachment"}


def tokens(*parts):
    """Text token string: str parts are literal text, dict parts are variables."""
    s, by = "", {}
    for p in parts:
        if isinstance(p, str):
            s += p
        else:
            by[f"{{{len(s)}, 1}}"] = p
            s += "￼"
    return {"Value": {"string": s, "attachmentsByRange": by}, "WFSerializationType": "WFTextTokenString"}


def act(ident, **params):
    return {"WFWorkflowActionIdentifier": ident, "WFWorkflowActionParameters": params}


def shell(uid, script, stdin=None):
    p = {"UUID": uid, "Script": script, "Shell": "/bin/zsh", "InputMode": "to stdin"}
    if stdin is not None:
        p["Input"] = stdin
    return act("is.workflow.actions.runshellscript", **p)


def build():
    r, l, sp, ch, t, sv, g, end, grp = (U() for _ in range(9))
    actions = [
        shell(r, RESOLVE, attach(EXT)),
        act("is.workflow.actions.conditional", GroupingIdentifier=grp, WFControlFlowMode=0,
            WFCondition=4, WFConditionalActionString=SENTINEL,
            WFInput={"Type": "Variable", "Variable": attach({**out(r, "Shell Script Result"), "Aggrandizements": STR})}),
        shell(l, LIST),
        act("is.workflow.actions.text.split", UUID=sp, text=attach(out(l, "Shell Script Result")),
            WFTextSeparator="New Lines"),
        act("is.workflow.actions.choosefromlist", UUID=ch, WFInput=attach(out(sp, "Split Text")),
            WFChooseFromListActionPrompt=tokens("Quick Config for ", EXT, "?")),
        act("is.workflow.actions.gettext", UUID=t, WFTextActionText=tokens(EXT, "\n", out(ch, "Chosen Item"))),
        shell(sv, SAVE, attach(out(t, "Text"))),
        act("is.workflow.actions.conditional", GroupingIdentifier=grp, WFControlFlowMode=1),
        act("is.workflow.actions.gettext", UUID=g, WFTextActionText=tokens(out(r, "Shell Script Result"))),
        act("is.workflow.actions.conditional", UUID=end, GroupingIdentifier=grp, WFControlFlowMode=2),
        act("com.rogueamoeba.soundsource.SetConfig", UUID=U(), config=attach(out(end, "If Result")),
            AppIntentDescriptor=SETCONFIG),
    ]
    return {"WFWorkflowActions": actions, "WFWorkflowClientVersion": "4610",
            "WFWorkflowMinimumClientVersion": 900, "WFWorkflowMinimumClientVersionString": "900",
            "WFWorkflowIcon": {"WFWorkflowIconStartColor": 4282601983, "WFWorkflowIconGlyphNumber": 59511},
            "WFWorkflowImportQuestions": [], "WFWorkflowInputContentItemClasses": INPUT_CLASSES,
            "WFWorkflowTypes": [], "WFWorkflowHasShortcutInputVariables": True,
            "WFWorkflowOutputContentItemClasses": []}


def generate(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    raw = os.path.join(out_dir, "Meeting Mode v2.wflow")
    signed = os.path.join(out_dir, "Meeting Mode v2.shortcut")
    with open(raw, "wb") as f:
        plistlib.dump(build(), f, fmt=plistlib.FMT_BINARY)
    subprocess.run(["shortcuts", "sign", "--mode", "anyone", "--input", raw, "--output", signed], check=True)
    print(signed)


def normalize(actions):
    """Deep copy with every UUID replaced by a token for where it is first defined or seen:
    A<n> for action n's UUID, G<n> for the nth grouping id, X<n> for an OutputUUID no action defines."""
    ids, count = {}, {"G": 0, "X": 0}
    for i, a in enumerate(actions):
        u = a["WFWorkflowActionParameters"].get("UUID")
        if u:
            ids.setdefault(u, f"A{i}")

    def seen(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ("GroupingIdentifier", "OutputUUID") and isinstance(v, str) and v not in ids:
                    t = "G" if k == "GroupingIdentifier" else "X"
                    ids[v] = f"{t}{count[t]}"
                    count[t] += 1
                seen(v)
        elif isinstance(o, list):
            for v in o:
                seen(v)

    def swap(o):
        if isinstance(o, dict):
            return {k: ids[v] if k in ("UUID", "GroupingIdentifier", "OutputUUID") and v in ids else swap(v)
                    for k, v in o.items()}
        if isinstance(o, list):
            return [swap(v) for v in o]
        return o

    seen(actions)
    return swap(actions)


def diff(w, g, path, extras):
    """Path of the first place `g` lacks or changes something in `w`; keys only in `g` go to `extras`."""
    if isinstance(w, dict):
        if not isinstance(g, dict):
            return f"{path}: not a dict"
        for k, wv in w.items():
            if k not in g:
                return f"{path}.{k}: missing"
            d = diff(wv, g[k], f"{path}.{k}", extras)
            if d:
                return d
        extras.extend(f"{path}.{k}" for k in g if k not in w)
    elif isinstance(w, list):
        if not isinstance(g, list) or len(w) != len(g):
            return f"{path}: list length differs"
        for i, (wv, gv) in enumerate(zip(w, g)):
            d = diff(wv, gv, f"{path}[{i}]", extras)
            if d:
                return d
    elif w != g or isinstance(w, bool) != isinstance(g, bool):
        return f"{path}: {str(w)[:60]!r} != {str(g)[:60]!r}"
    return None


def compare(want, got):
    """Pure comparison of generated vs imported action arrays: [(ok, first_diff, extras)] per action."""
    wn, gn = normalize(want), normalize(got)
    res = []
    for i in range(max(len(wn), len(gn))):
        extras = []
        if i >= len(gn):
            res.append((False, f"[{i}]: missing from imported Shortcut", extras))
        elif i >= len(wn):
            res.append((False, f"[{i}]: not in generated Shortcut", extras))
        else:
            d = diff(wn[i], gn[i], f"[{i}]", extras)
            res.append((d is None, d, extras))
    return res


def verify(name):
    src = os.path.expanduser("~/Library/Shortcuts/Shortcuts.sqlite")
    with tempfile.TemporaryDirectory() as tmp:
        live = sqlite3.connect("file:" + urllib.parse.quote(src) + "?mode=ro", uri=True)
        copy_db = sqlite3.connect(os.path.join(tmp, "Shortcuts.sqlite"))
        try:
            live.backup(copy_db)  # read a copy; never write to the live database
            cols = {r[1] for r in copy_db.execute("pragma table_info(ZSHORTCUT)")}
            classes_col = "s.ZINPUTCLASSESDATA" if "ZINPUTCLASSESDATA" in cols else "null"
            row = copy_db.execute(f"select a.ZDATA, {classes_col} from ZSHORTCUT s "
                                  "join ZSHORTCUTACTIONS a on a.ZSHORTCUT = s.Z_PK "
                                  "where s.ZNAME = ? order by s.Z_PK desc limit 1", (name,)).fetchone()
        finally:
            live.close()
            copy_db.close()
    assert row, f"no Shortcut named {name!r}"
    results = compare(build()["WFWorkflowActions"], plistlib.loads(row[0]))
    for i, (ok, d, extras) in enumerate(results):
        print(("ok  " if ok else "BAD ") + f"{i:2} " + (d or ""))
        if extras:
            print("      extra imported keys: " + ", ".join(extras))
    good = all(ok for ok, *_ in results)
    # ZSHORTCUTACTIONS holds the actions array only. Input classes come from ZSHORTCUT when that
    # column exists; WFWorkflowHasShortcutInputVariables is not readable from these tables.
    if row[1] is None:
        print("note: ZSHORTCUT.ZINPUTCLASSESDATA not available; input classes not checked")
    else:
        try:
            got = plistlib.loads(row[1])
        except Exception:
            got = None
        if got is None:
            print("note: ZINPUTCLASSESDATA is not a plist; input classes not checked")
        else:
            match = isinstance(got, list) and sorted(got) == sorted(INPUT_CLASSES)
            print(("ok  " if match else "BAD ") + "input classes")
            good = good and match
    print("note: WFWorkflowHasShortcutInputVariables not checked (not in the stored tables)")
    assert good, "imported Shortcut does not match the generated one"
    print("verify: ok")


if __name__ == "__main__":
    args = sys.argv[1:]
    if args == ["--selftest"]:
        selftest()
    elif len(args) == 2 and args[0] == "--verify":
        verify(args[1])
    elif len(args) == 1 and not args[0].startswith("-"):
        generate(args[0])
    else:
        sys.exit("usage: --selftest | OUT_DIR | --verify NAME")
