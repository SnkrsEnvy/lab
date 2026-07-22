#include "GrandCoreCharacter.h"
#include "GrandCoreHUD.h"
#include "GrandStation.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "Engine/World.h"
#include "DrawDebugHelpers.h"

AGrandCoreCharacter::AGrandCoreCharacter()
{
    PrimaryActorTick.bCanEverTick = true;

    // Human-scale collision: 0.34 m radius, 1.76 m body height.
    GetCapsuleComponent()->InitCapsuleSize(34.0f, 88.0f);

    FirstPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FirstPersonCamera"));
    FirstPersonCamera->SetupAttachment(GetCapsuleComponent());
    // Capsule center is 88 cm above floor; 78 cm gives a 166 cm eye height.
    FirstPersonCamera->SetRelativeLocation(FVector(0.0f, 0.0f, 78.0f));
    FirstPersonCamera->bUsePawnControlRotation = true;
    FirstPersonCamera->FieldOfView = 62.0f;

    bUseControllerRotationPitch = false;
    bUseControllerRotationRoll = false;
    bUseControllerRotationYaw = true;

    UCharacterMovementComponent* Move = GetCharacterMovement();
    Move->bOrientRotationToMovement = false;
    Move->MaxWalkSpeed = 200.0f;
    Move->MaxAcceleration = 600.0f;
    Move->BrakingDecelerationWalking = 840.0f;
    Move->GroundFriction = 8.0f;
    Move->bUseSeparateBrakingFriction = true;
    Move->BrakingFriction = 8.0f;
    Move->MaxSimulationTimeStep = 1.0f / 120.0f;
    Move->MaxSimulationIterations = 8;
    Move->bEnablePhysicsInteraction = false;
    Move->NavAgentProps.bCanCrouch = false;
    Move->AirControl = 0.0f;
}

void AGrandCoreCharacter::BeginPlay()
{
    Super::BeginPlay();
    UpdateSpeed();
}

void AGrandCoreCharacter::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    if (!TouchMove.IsNearlyZero())
    {
        MoveForward(TouchMove.Y);
        MoveRight(TouchMove.X);
    }

    if (!TouchLook.IsNearlyZero())
    {
        // Touch is frame-rate independent and deliberately damped.
        AddControllerYawInput(TouchLook.X * 52.0f * DeltaSeconds);
        AddControllerPitchInput(TouchLook.Y * -38.0f * DeltaSeconds);
    }
}

void AGrandCoreCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
    Super::SetupPlayerInputComponent(PlayerInputComponent);
    check(PlayerInputComponent);

    PlayerInputComponent->BindAxis(TEXT("MoveForward"), this, &AGrandCoreCharacter::MoveForward);
    PlayerInputComponent->BindAxis(TEXT("MoveRight"), this, &AGrandCoreCharacter::MoveRight);
    PlayerInputComponent->BindAxis(TEXT("Turn"), this, &AGrandCoreCharacter::Turn);
    PlayerInputComponent->BindAxis(TEXT("LookUp"), this, &AGrandCoreCharacter::LookUp);

    PlayerInputComponent->BindAction(TEXT("Sprint"), IE_Pressed, this, &AGrandCoreCharacter::StartSprint);
    PlayerInputComponent->BindAction(TEXT("Sprint"), IE_Released, this, &AGrandCoreCharacter::StopSprint);
    PlayerInputComponent->BindAction(TEXT("Interact"), IE_Pressed, this, &AGrandCoreCharacter::Interact);
    PlayerInputComponent->BindAction(TEXT("Diagnostics"), IE_Pressed, this, &AGrandCoreCharacter::ToggleDiagnostics);
}

void AGrandCoreCharacter::MoveForward(float Value)
{
    if (Controller && !FMath::IsNearlyZero(Value))
    {
        const FRotator YawRotation(0.0f, Controller->GetControlRotation().Yaw, 0.0f);
        AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X), Value);
    }
}

void AGrandCoreCharacter::MoveRight(float Value)
{
    if (Controller && !FMath::IsNearlyZero(Value))
    {
        const FRotator YawRotation(0.0f, Controller->GetControlRotation().Yaw, 0.0f);
        AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y), Value);
    }
}

void AGrandCoreCharacter::Turn(float Value)
{
    AddControllerYawInput(Value);
}

void AGrandCoreCharacter::LookUp(float Value)
{
    AddControllerPitchInput(Value);
}

void AGrandCoreCharacter::StartSprint()
{
    bSprinting = true;
    UpdateSpeed();
}

void AGrandCoreCharacter::StopSprint()
{
    bSprinting = false;
    UpdateSpeed();
}

void AGrandCoreCharacter::UpdateSpeed()
{
    GetCharacterMovement()->MaxWalkSpeed = bSprinting ? 315.0f : 200.0f;
}

void AGrandCoreCharacter::Interact()
{
    if (!FirstPersonCamera) return;

    const FVector Start = FirstPersonCamera->GetComponentLocation();
    const FVector End = Start + FirstPersonCamera->GetForwardVector() * 1000.0f;
    FHitResult Hit;
    FCollisionQueryParams Params(SCENE_QUERY_STAT(GrandCoreInteract), false, this);

    if (GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params))
    {
        if (AGrandStation* Station = Cast<AGrandStation>(Hit.GetActor()))
        {
            Station->Interact(this);
        }
    }
}

void AGrandCoreCharacter::ToggleDiagnostics()
{
    if (APlayerController* PC = Cast<APlayerController>(Controller))
    {
        if (AGrandCoreHUD* HUD = Cast<AGrandCoreHUD>(PC->GetHUD()))
        {
            HUD->ToggleDiagnostics();
        }
    }
}

void AGrandCoreCharacter::SetTouchMove(const FVector2D& Value)
{
    TouchMove = Value.GetClampedToMaxSize(1.0f);
}

void AGrandCoreCharacter::SetTouchLook(const FVector2D& Value)
{
    TouchLook = Value.GetClampedToMaxSize(1.0f);
}

void AGrandCoreCharacter::ClearTouchMove()
{
    TouchMove = FVector2D::ZeroVector;
}

void AGrandCoreCharacter::ClearTouchLook()
{
    TouchLook = FVector2D::ZeroVector;
}
