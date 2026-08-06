#include "HCLPodGameMode.h"
#include "HCLPodCharacter.h"

AHCLPodGameMode::AHCLPodGameMode()
{
    DefaultPawnClass = AHCLPodCharacter::StaticClass();
}
