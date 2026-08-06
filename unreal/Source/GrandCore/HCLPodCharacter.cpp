#include "HCLPodCharacter.h"

#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/Controller.h"
#include "InputCoreTypes.h"

AHCLPodCharacter::AHCLPodCharacter()
{
    PrimaryActorTick.bCanEverTick = true;
}

void AHCLPodCharacter::BeginPlay()
{
    Super::BeginPlay();

    FounderResetLocation = GetActorLocation();
    FounderResetRotation = GetActorRotation();

    if (Controller)
    {
        FounderResetRotation = Controller->GetControlRotation();
    }

    FounderResetRotation.Pitch = 0.0f;
    FounderResetRotation.Roll = 0.0f;
    bFounderResetCaptured = true;

    ClampFounderView();
}

void AHCLPodCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);
    check(PlayerInputComponent);

    PlayerInputComponent->BindKey(EKeys::Home, IE_Pressed, this, &AHCLPodCharacter::ResetToFounderView);
}

void AHCLPodCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    ClampFounderView();

    if (bFounderResetCaptured)
    {
        const bool bDroppedBelowSafetyPlane = GetActorLocation().Z < FounderResetLocation.Z - RecoveryDropDistance;
        if (bDroppedBelowSafetyPlane || !IsTransformFinite())
        {
            ResetToFounderView();
        }
    }
}

void AHCLPodCharacter::ResetToFounderView()
{
    if (!bFounderResetCaptured)
    {
        return;
    }

    if (UCharacterMovementComponent* Movement = GetCharacterMovement())
    {
        Movement->StopMovementImmediately();
    }

    SetActorLocationAndRotation(
        FounderResetLocation,
        FRotator(0.0f, FounderResetRotation.Yaw, 0.0f),
        false,
        nullptr,
        ETeleportType::TeleportPhysics);

    if (Controller)
    {
        Controller->SetControlRotation(FounderResetRotation);
    }
}

void AHCLPodCharacter::ClampFounderView()
{
    if (!Controller)
    {
        return;
    }

    FRotator Rotation = Controller->GetControlRotation();
    Rotation.Pitch = FMath::Clamp(FRotator::NormalizeAxis(Rotation.Pitch), MinimumViewPitch, MaximumViewPitch);
    Rotation.Roll = 0.0f;
    Controller->SetControlRotation(Rotation);
}

bool AHCLPodCharacter::IsTransformFinite() const
{
    const FVector Location = GetActorLocation();
    const FRotator Rotation = GetActorRotation();

    return
        FMath::IsFinite(Location.X) &&
        FMath::IsFinite(Location.Y) &&
        FMath::IsFinite(Location.Z) &&
        FMath::IsFinite(Rotation.Pitch) &&
        FMath::IsFinite(Rotation.Yaw) &&
        FMath::IsFinite(Rotation.Roll);
}
