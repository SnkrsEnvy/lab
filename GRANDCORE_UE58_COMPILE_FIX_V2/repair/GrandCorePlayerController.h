#pragma once

#include "CoreMinimal.h"
#include "InputCoreTypes.h"
#include "GameFramework/PlayerController.h"
#include "GrandCorePlayerController.generated.h"

UCLASS()
class GRANDCORE_API AGrandCorePlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    AGrandCorePlayerController();
    virtual void BeginPlay() override;
    virtual bool InputTouch(
        const FTouchId TouchId,
        const ETouchType::Type Type,
        const FVector2D& TouchLocation,
        const float Force,
        const uint64 Timestamp) override;

private:
    FTouchId MoveTouchId;
    FTouchId LookTouchId;
    FVector2D MoveTouchOrigin = FVector2D::ZeroVector;
    FVector2D LookTouchPrevious = FVector2D::ZeroVector;
};
