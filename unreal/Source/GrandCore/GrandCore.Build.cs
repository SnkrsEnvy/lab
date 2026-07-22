using UnrealBuildTool;

public class GrandCore : ModuleRules
{
    public GrandCore(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core", "CoreUObject", "Engine", "InputCore", "EnhancedInput",
            "RHI", "RenderCore", "ApplicationCore", "Slate", "SlateCore", "UMG"
        });
    }
}
