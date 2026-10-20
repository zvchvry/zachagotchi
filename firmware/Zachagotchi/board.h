#pragma once
// Freenove FNK0104B, ILI9341 240x320 + FT6336 capacitive touch, N16R8.
// Pins verified against Freenove's FNK0104AB TFT setup and touch/battery examples.
constexpr int LCD_SCLK=12, LCD_MOSI=11, LCD_MISO=13, LCD_CS=10, LCD_DC=46, LCD_BL=45;
constexpr int TOUCH_SDA=16, TOUCH_SCL=15, TOUCH_RST=18, TOUCH_INT=17, BATTERY_ADC=9;
constexpr uint8_t TOUCH_ADDRESS=0x38;
constexpr uint16_t LCD_INK=((38>>3)<<11)|((56>>2)<<5)|(41>>3);
constexpr uint16_t LCD_PAPER=((220>>3)<<11)|((230>>2)<<5)|(192>>3);
constexpr uint32_t IDLE_MS=60000, DOUBLE_TAP_MS=400;
struct TouchPoint { int x=0, y=0; };
