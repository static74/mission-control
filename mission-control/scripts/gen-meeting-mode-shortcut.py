#!/usr/bin/env python3
"""Generate, sign, and verify the `Meeting Mode v2` Shortcut (Mission Control plugin).

Spec: docs/superpowers/specs/2026-10-12-quick-config-picker-design.md
Run with `python3 -I`. Python 3 stdlib only.
"""
import os, plistlib, shutil, sqlite3, subprocess, sys, tempfile, uuid

DIR = '"$HOME/Library/Application Support/Mission Control"'
SENTINEL = "__MC_PICK__"  # ponytail: a Quick Config literally named this would be treated as "nothing saved"

# stdin: one of meeting | normal | reset meeting | reset normal (no trailing newline).
# Prints the saved Quick Config name for the mode, or the sentinel when none is saved.
RESOLVE = f'''d={DIR}
in=$(cat)
mode=${{in#reset }}
case $mode in meeting|normal) ;; *) print -u2 "Mission Control: unexpected input [$in]"; exit 2;; esac
[ "$in" != "$mode" ] && rm -f "$d/meeting-config" "$d/normal-config"
saved=$(cat "$d/$mode-config" 2>/dev/null)
if [ -n "$saved" ]; then printf '%s' "$saved"; else printf '%s' {SENTINEL}; fi'''

# Prints SoundSource's Quick Config names, newline-separated, no trailing newline.
LIST = '''f="$HOME/Library/Application Support/SoundSource/Presets.v2.plist"
names=()
g=0; while u=$(plutil -extract $g.uuid raw "$f" 2>/dev/null); do
  if [ "$u" = Configs ]; then i=0; while n=$(plutil -extract $g.presets.$i.name raw "$f" 2>/dev/null); do names+=("$n"); i=$((i+1)); done; fi
  g=$((g+1)); done
printf '%s' "${(F)names}"'''

# stdin: line 1 = the Shortcut input, rest = the picked name. The name arrives on stdin,
# never in the command string, so apostrophes and quotes are safe.
SAVE = f'''d={DIR}
IFS= read -r in
pick=$(cat)
mode=${{in#reset }}
mkdir -p "$d"
printf '%s' "$pick" > "$d/$mode-config"
printf '%s' "$pick"'''


def sh(script, stdin, home):
    r = subprocess.run(["/bin/zsh", "-c", script], input=stdin, capture_output=True, text=True,
                       env={"HOME": home, "PATH": "/usr/bin:/bin"})
    return r.returncode, r.stdout


def selftest():
    home = tempfile.mkdtemp()
    d = os.path.join(home, "Library/Application Support/Mission Control")
    name = 'Bob\'s "HiFi" Mix'
    assert sh(RESOLVE, "meeting", home) == (0, SENTINEL), "nothing saved -> sentinel"
    assert sh(SAVE, "meeting\n" + name, home) == (0, name), "save echoes the pick"
    assert open(os.path.join(d, "meeting-config")).read() == name, "file is byte-exact"
    assert sh(RESOLVE, "meeting", home) == (0, name), "saved pick read back exactly"
    assert sh(RESOLVE, "normal", home) == (0, SENTINEL), "modes are independent"
    assert sh(SAVE, "normal\nHiFi Club", home) == (0, "HiFi Club")
    assert sh(RESOLVE, "reset normal", home) == (0, SENTINEL), "reset prompts for current mode"
    assert not os.path.exists(os.path.join(d, "meeting-config")), "reset clears BOTH picks"
    assert sh(SAVE, "reset meeting\nHeadphones", home) == (0, "Headphones"), "reset input saves to the mode"
    assert open(os.path.join(d, "meeting-config")).read() == "Headphones"
    for bad in ["", "bogus", "reset", "reset  meeting"]:
        assert sh(RESOLVE, bad, home)[0] == 2, f"unexpected input {bad!r} -> exit 2"
    shutil.rmtree(home)
    print("selftest: ok")


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
    raw = os.path.join(out_dir, "Meeting Mode v2.wflow")
    signed = os.path.join(out_dir, "Meeting Mode v2.shortcut")
    with open(raw, "wb") as f:
        plistlib.dump(build(), f, fmt=plistlib.FMT_BINARY)
    subprocess.run(["shortcuts", "sign", "--mode", "anyone", "--input", raw, "--output", signed], check=True)
    print(signed)


def shape(actions):
    """What must survive import: each action's identifier and parameter keys."""
    return [(a["WFWorkflowActionIdentifier"], sorted(k for k in a.get("WFWorkflowActionParameters", {})
             if k != "UUID")) for a in actions]


def verify(name):
    tmp = tempfile.mkdtemp()
    src = os.path.expanduser("~/Library/Shortcuts")
    for f in os.listdir(src):  # read a copy; never open the live database
        if f.startswith("Shortcuts.sqlite"):
            shutil.copy(os.path.join(src, f), tmp)
    db = sqlite3.connect(os.path.join(tmp, "Shortcuts.sqlite"))
    row = db.execute("select a.ZDATA from ZSHORTCUT s join ZSHORTCUTACTIONS a on a.ZSHORTCUT = s.Z_PK "
                     "where s.ZNAME = ? order by s.Z_PK desc limit 1", (name,)).fetchone()
    assert row, f"no Shortcut named {name!r}"
    got, want = shape(plistlib.loads(row[0])), shape(build()["WFWorkflowActions"])
    for i, (g, w) in enumerate(zip(got, want)):
        print(("ok  " if g == w else "BAD ") + f"{i:2} {g[0]}")
    assert len(got) == len(want) and got == want, "imported Shortcut does not match the generated one"
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
