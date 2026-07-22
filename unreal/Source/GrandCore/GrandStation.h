#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GrandStation.generated.h"

class UStaticMeshComponent;
class UBoxComponent;

USTRUCT(BlueprintType)
struct FGrandStationDescriptor
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite) FText Title;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FText Category;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, meta=(MultiLine=true)) FText Description;
    UPROPERTY(EditAnywhere, BlueprintReadWrite) FString ExternalURL;
};

UCLASS(Blueprintable)
class GRANDCORE_API AGrandStation : public AActor
{
    GENERATED_BODY()

public:
    AGrandStation();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UStaticMeshComponent> Visual;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly)
    TObjectPtr<UBoxComponent> InteractionVolume;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Station")
    FGrandStationDescriptor Descriptor;

    UFUNCTION(BlueprintCallable, BlueprintNativeEvent, Category="Station")
    void Interact(APawn* Visitor);
    virtual void Interact_Implementation(APawn* Visitor);
};
