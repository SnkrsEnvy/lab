using UnrealBuildTool;
using System.Collections.Generic;

public class GrandCoreEditorTarget : TargetRules
{
    public GrandCoreEditorTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Editor;
        DefaultBuildSettings = BuildSettingsVersion.V6;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("GrandCore");
    }
}
