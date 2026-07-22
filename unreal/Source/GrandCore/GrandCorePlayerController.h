#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "GrandCorePlayerController.generated.h"

UCLASS()
class GRANDCORE_API AGrandCorePlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    AGrandCorePlayerController();
    virtual void BeginPlay() override;
    virtual bool InputTouch(uint32 Handle, ETouchType::Type Type, const FVector2D& TouchLocation, float Force, FDateTime DeviceTimestamp, uint32 TouchpadIndex) override;

private:
    int32 MoveTouchHandle = INDEX_NONE;
    int32 LookTouchHandle = INDEX_NONE;
    FVector2D MoveTouchOrigin = FVector2D::ZeroVector;
    FVector2D LookTouchPrevious = FVector2D::ZeroVector;
};
