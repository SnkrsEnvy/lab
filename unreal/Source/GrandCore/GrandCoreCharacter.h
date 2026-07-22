#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "GrandCoreCharacter.generated.h"

class UCameraComponent;

UCLASS()
class GRANDCORE_API AGrandCoreCharacter : public ACharacter
{
    GENERATED_BODY()

public:
    AGrandCoreCharacter();
    virtual void Tick(float DeltaSeconds) override;
    virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

    void SetTouchMove(const FVector2D& Value);
    void SetTouchLook(const FVector2D& Value);
    void ClearTouchMove();
    void ClearTouchLook();

protected:
    virtual void BeginPlay() override;

private:
    UPROPERTY(VisibleAnywhere, Category="Grand Core")
    TObjectPtr<UCameraComponent> FirstPersonCamera;

    FVector2D TouchMove = FVector2D::ZeroVector;
    FVector2D TouchLook = FVector2D::ZeroVector;
    bool bSprinting = false;

    void MoveForward(float Value);
    void MoveRight(float Value);
    void Turn(float Value);
    void LookUp(float Value);
    void StartSprint();
    void StopSprint();
    void Interact();
    void ToggleDiagnostics();
    void UpdateSpeed();
};
