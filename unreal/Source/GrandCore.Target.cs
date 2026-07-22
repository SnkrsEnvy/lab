using UnrealBuildTool;
using System.Collections.Generic;

public class GrandCoreTarget : TargetRules
{
    public GrandCoreTarget(TargetInfo Target) : base(Target)
    {
        Type = TargetType.Game;
        DefaultBuildSettings = BuildSettingsVersion.V6;
        IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
        ExtraModuleNames.Add("GrandCore");
    }
}
