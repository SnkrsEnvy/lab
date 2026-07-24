#include "GrandCoreHUD.h"
#include "CanvasItem.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "RHI.h"
#include "DynamicRHI.h"
#include "Misc/App.h"

void AGrandCoreHUD::ToggleDiagnostics()
{
    bShowDiagnostics = !bShowDiagnostics;
}

void AGrandCoreHUD::DrawHUD()
{
    Super::DrawHUD();
    if (!bShowDiagnostics || !Canvas || !GEngine)
    {
        return;
    }

    const float FPS = FMath::Max(0.0f, 1.0f / FMath::Max(FApp::GetDeltaTime(), 0.0001f));
    const FString RHIName = GDynamicRHI ? FString(GDynamicRHI->GetName()) : TEXT("Unknown");
    const FString Adapter = GRHIAdapterName.IsEmpty() ? TEXT("Unknown GPU") : GRHIAdapterName;
    const FIntPoint Size(Canvas->SizeX, Canvas->SizeY);

    const float X = 24.0f;
    float Y = 22.0f;
    const FLinearColor Gold(1.0f, 0.78f, 0.42f, 0.95f);
    const FLinearColor White(1.0f, 1.0f, 1.0f, 0.88f);

    auto DrawLine = [&](const FString& Text, const FLinearColor& Color, const float Advance)
    {
        FCanvasTextItem Item(
            FVector2D(X, Y),
            FText::FromString(Text),
            GEngine->GetSmallFont(),
            Color);
        Item.EnableShadow(FLinearColor(0.0f, 0.0f, 0.0f, 0.75f));
        Canvas->DrawItem(Item);
        Y += Advance;
    };

    DrawLine(TEXT("GRAND CORE — MASTER"), Gold, 20.0f);
    DrawLine(FString::Printf(TEXT("Backend: %s"), *RHIName), White, 17.0f);
    DrawLine(FString::Printf(TEXT("Adapter: %s"), *Adapter), White, 17.0f);
    DrawLine(FString::Printf(TEXT("Output: %d x %d"), Size.X, Size.Y), White, 17.0f);
    DrawLine(FString::Printf(TEXT("FPS: %.1f"), FPS), White, 17.0f);
    DrawLine(TEXT("WASD / mouse • Shift sprint • E interact • F3 diagnostics"), White, 17.0f);
}
