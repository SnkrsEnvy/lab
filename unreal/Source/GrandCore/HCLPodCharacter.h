#pragma once

#include "CoreMinimal.h"
#include "GrandCoreCharacter.h"
#include "HCLPodCharacter.generated.h"

/**
 * Huckleberry Podcast Lounge visitor pawn.
 *
 * Preserves the proven Grand Core movement stack while adding the bounded
 * Founder-view contract required by HCL-POD-IMM-001: stable human pitch,
 * locked roll, Home reset, and safety recovery when the pawn leaves the room.
 */
UCLASS()
class GRANDCORE_API AHCLPodCharacter : public AGrandCoreCharacter
{
    GENERATED_BODY()

public:
    AHCLPodCharacter();

    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

protected:
    virtual void BeginPlay() override;

private:
    FVector FounderResetLocation = FVector::ZeroVector;
    FRotator FounderResetRotation = FRotator::ZeroRotator;
    bool bFounderResetCaptured = false;

    UPROPERTY(EditDefaultsOnly, Category="Huckleberry|View")
    float MinimumViewPitch = -55.0f;

    UPROPERTY(EditDefaultsOnly, Category="Huckleberry|View")
    float MaximumViewPitch = 65.0f;

    UPROPERTY(EditDefaultsOnly, Category="Huckleberry|Safety")
    float RecoveryDropDistance = 250.0f;

    void ResetToFounderView();
    void ClampFounderView();
    bool IsTransformFinite() const;
};
