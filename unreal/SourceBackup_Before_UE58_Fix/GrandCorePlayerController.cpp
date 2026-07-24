#include "GrandCorePlayerController.h"
#include "GrandCoreCharacter.h"
#include "Engine/GameViewportClient.h"
#include "Engine/Engine.h"

AGrandCorePlayerController::AGrandCorePlayerController()
{
    bEnableTouchEvents = true;
    bEnableClickEvents = true;
    bShowMouseCursor = false;
}

void AGrandCorePlayerController::BeginPlay()
{
    Super::BeginPlay();
    FInputModeGameOnly Mode;
    SetInputMode(Mode);
}

bool AGrandCorePlayerController::InputTouch(
    const FTouchId TouchId,
    const ETouchType::Type Type,
    const FVector2D& TouchLocation,
    const float Force,
    const uint64 Timestamp)
{
    AGrandCoreCharacter* Character = Cast<AGrandCoreCharacter>(GetPawn());
    if (!Character)
    {
        return Super::InputTouch(TouchId, Type, TouchLocation, Force, Timestamp);
    }

    FVector2D ViewSize(1920.0f, 1080.0f);
    if (GEngine && GEngine->GameViewport)
    {
        GEngine->GameViewport->GetViewportSize(ViewSize);
    }

    if (Type == ETouchType::Began)
    {
        if (TouchLocation.X < ViewSize.X * 0.5f && !MoveTouchId.IsValid())
        {
            MoveTouchId = TouchId;
            MoveTouchOrigin = TouchLocation;
        }
        else if (!LookTouchId.IsValid())
        {
            LookTouchId = TouchId;
            LookTouchPrevious = TouchLocation;
        }
    }
    else if (Type == ETouchType::Moved)
    {
        if (TouchId == MoveTouchId)
        {
            const FVector2D Delta = (TouchLocation - MoveTouchOrigin) / 110.0f;
            Character->SetTouchMove(FVector2D(Delta.X, -Delta.Y));
        }
        else if (TouchId == LookTouchId)
        {
            const FVector2D Delta = TouchLocation - LookTouchPrevious;
            Character->SetTouchLook(Delta / 18.0f);
            LookTouchPrevious = TouchLocation;
        }
    }
    else if (Type == ETouchType::Ended)
    {
        if (TouchId == MoveTouchId)
        {
            MoveTouchId = FTouchId();
            Character->ClearTouchMove();
        }
        if (TouchId == LookTouchId)
        {
            LookTouchId = FTouchId();
            Character->ClearTouchLook();
        }
    }

    return true;
}
