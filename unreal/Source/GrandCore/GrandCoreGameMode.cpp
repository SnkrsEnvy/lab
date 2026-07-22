#include "GrandCoreGameMode.h"
#include "GrandCoreCharacter.h"
#include "GrandCorePlayerController.h"
#include "GrandCoreHUD.h"

AGrandCoreGameMode::AGrandCoreGameMode()
{
    DefaultPawnClass = AGrandCoreCharacter::StaticClass();
    PlayerControllerClass = AGrandCorePlayerController::StaticClass();
    HUDClass = AGrandCoreHUD::StaticClass();
}
