#include "GrandStation.h"
#include "Components/StaticMeshComponent.h"
#include "Components/BoxComponent.h"
#include "Engine/Engine.h"

AGrandStation::AGrandStation()
{
    PrimaryActorTick.bCanEverTick = false;
    Visual = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Visual"));
    RootComponent = Visual;

    InteractionVolume = CreateDefaultSubobject<UBoxComponent>(TEXT("InteractionVolume"));
    InteractionVolume->SetupAttachment(RootComponent);
    InteractionVolume->SetBoxExtent(FVector(100.0f));
    InteractionVolume->SetCollisionProfileName(TEXT("OverlapAllDynamic"));
}

void AGrandStation::Interact_Implementation(APawn* Visitor)
{
    if (GEngine)
    {
        const FString Message = Descriptor.Title.IsEmpty() ? GetName() : Descriptor.Title.ToString();
        GEngine->AddOnScreenDebugMessage(-1, 3.5f, FColor(245, 202, 136), Message);
    }
}
