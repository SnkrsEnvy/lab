#pragma once

#include "CoreMinimal.h"
#include "GrandCoreGameMode.h"
#include "HCLPodGameMode.generated.h"

/** Dedicated non-destructive GameMode for the Huckleberry Podcast Lounge. */
UCLASS()
class GRANDCORE_API AHCLPodGameMode : public AGrandCoreGameMode
{
    GENERATED_BODY()

public:
    AHCLPodGameMode();
};
