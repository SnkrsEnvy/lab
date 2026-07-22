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

bool AGrandCorePlayerController::InputTouch(uint32 Handle, ETouchType::Type Type, const FVector2D& TouchLocation, float Force, FDateTime DeviceTimestamp, uint32 TouchpadIndex)
{
    AGrandCoreCharacter* Character = Cast<AGrandCoreCharacter>(GetPawn());
    if (!Character) return Super::InputTouch(Handle, Type, TouchLocation, Force, DeviceTimestamp, TouchpadIndex);

    FVector2D ViewSize(1920.0f, 1080.0f);
    if (GEngine && GEngine->GameViewport)
    {
        GEngine->GameViewport->GetViewportSize(ViewSize);
    }

    if (Type == ETouchType::Began)
    {
        if (TouchLocation.X < ViewSize.X * 0.5f && MoveTouchHandle == INDEX_NONE)
        {
            MoveTouchHandle = static_cast<int32>(Handle);
            MoveTouchOrigin = TouchLocation;
        }
        else if (LookTouchHandle == INDEX_NONE)
        {
            LookTouchHandle = static_cast<int32>(Handle);
            LookTouchPrevious = TouchLocation;
        }
    }
    else if (Type == ETouchType::Moved)
    {
        if (static_cast<int32>(Handle) == MoveTouchHandle)
        {
            const FVector2D Delta = (TouchLocation - MoveTouchOrigin) / 110.0f;
            Character->SetTouchMove(FVector2D(Delta.X, -Delta.Y));
        }
        else if (static_cast<int32>(Handle) == LookTouchHandle)
        {
            const FVector2D Delta = TouchLocation - LookTouchPrevious;
            Character->SetTouchLook(Delta / 18.0f);
            LookTouchPrevious = TouchLocation;
        }
    }
    else if (Type == ETouchType::Ended)
    {
        if (static_cast<int32>(Handle) == MoveTouchHandle)
        {
            MoveTouchHandle = INDEX_NONE;
            Character->ClearTouchMove();
        }
        if (static_cast<int32>(Handle) == LookTouchHandle)
        {
            LookTouchHandle = INDEX_NONE;
            Character->ClearTouchLook();
        }
    }

    return true;
}
