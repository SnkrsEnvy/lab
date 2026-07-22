#include "GrandCoreHUD.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "RHI.h"
#include "DynamicRHI.h"
#include "HAL/PlatformTime.h"
#include "Misc/App.h"

void AGrandCoreHUD::ToggleDiagnostics()
{
    bShowDiagnostics = !bShowDiagnostics;
}

void AGrandCoreHUD::DrawHUD()
{
    Super::DrawHUD();
    if (!bShowDiagnostics || !Canvas || !GEngine) return;

    const float FPS = FMath::Max(0.0f, 1.0f / FMath::Max(FApp::GetDeltaTime(), 0.0001f));
    const FString RHIName = GDynamicRHI ? FString(GDynamicRHI->GetName()) : TEXT("Unknown");
    const FString Adapter = GRHIAdapterName.IsEmpty() ? TEXT("Unknown GPU") : GRHIAdapterName;
    const FIntPoint Size(Canvas->SizeX, Canvas->SizeY);

    const float X = 24.0f;
    float Y = 22.0f;
    const FLinearColor Gold(1.0f, 0.78f, 0.42f, 0.95f);
    const FLinearColor White(1.0f, 1.0f, 1.0f, 0.88f);

    Canvas->DrawText(GEngine->GetSmallFont(), TEXT("GRAND CORE — MASTER"), X, Y, 1.0f, 1.0f, FFontRenderInfo(), Gold);
    Y += 20.0f;
    Canvas->DrawText(GEngine->GetSmallFont(), FString::Printf(TEXT("Backend: %s"), *RHIName), X, Y, 1.0f, 1.0f, FFontRenderInfo(), White);
    Y += 17.0f;
    Canvas->DrawText(GEngine->GetSmallFont(), FString::Printf(TEXT("Adapter: %s"), *Adapter), X, Y, 1.0f, 1.0f, FFontRenderInfo(), White);
    Y += 17.0f;
    Canvas->DrawText(GEngine->GetSmallFont(), FString::Printf(TEXT("Output: %d x %d"), Size.X, Size.Y), X, Y, 1.0f, 1.0f, FFontRenderInfo(), White);
    Y += 17.0f;
    Canvas->DrawText(GEngine->GetSmallFont(), FString::Printf(TEXT("FPS: %.1f"), FPS), X, Y, 1.0f, 1.0f, FFontRenderInfo(), White);
    Y += 17.0f;
    Canvas->DrawText(GEngine->GetSmallFont(), TEXT("WASD / mouse • Shift sprint • E interact • F3 diagnostics"), X, Y, 1.0f, 1.0f, FFontRenderInfo(), White);
}
