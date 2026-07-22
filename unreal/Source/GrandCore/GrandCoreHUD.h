#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "GrandCoreHUD.generated.h"

UCLASS()
class GRANDCORE_API AGrandCoreHUD : public AHUD
{
    GENERATED_BODY()

public:
    virtual void DrawHUD() override;
    void ToggleDiagnostics();

private:
    bool bShowDiagnostics = true;
};
