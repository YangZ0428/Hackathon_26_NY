import math

def oklch_hex(L, C, H):
    a = C*math.cos(math.radians(H)); b = C*math.sin(math.radians(H))
    l_ = L + 0.3963377774*a + 0.2158037573*b
    m_ = L - 0.1055613458*a - 0.0638541728*b
    s_ = L - 0.0894841775*a - 1.2914855480*b
    l, m, s = l_**3, m_**3, s_**3
    rgb = ( 4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
           -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
           -0.0041960863*l - 0.7034186147*m + 1.7076147010*s)
    out = []
    for v in rgb:
        v = 12.92*v if v <= 0.0031308 else 1.055*(v**(1/2.4)) - 0.055
        out.append(max(0, min(255, round(v*255))))
    return "#%02X%02X%02X" % tuple(out)

TOKENS = {
  "background":       (0.995, 0.003, 95),
  "foreground":       (0.22,  0.025, 157),
  "primary":          (0.46,  0.11,  151),
  "secondary":        (0.965, 0.012, 147),
  "muted_foreground": (0.51,  0.024, 155),
  "accent":           (0.94,  0.025, 148),
  "border":           (0.90,  0.009, 105),
  "canvas":           (0.97,  0.009, 104),
  "good":             (0.58,  0.16,  151),
  "good_soft":        (0.96,  0.035, 148),
  "good_border":      (0.84,  0.07,  148),
  "good_strong":      (0.39,  0.12,  151),
  "warm":             (0.75,  0.16,  78),
  "sun":              (0.55,  0.13,  69),
  "sun_soft":         (0.95,  0.055, 83),
  "schedule":         (0.72,  0.025, 250),
}
HEX = {k: oklch_hex(*v) for k, v in TOKENS.items()}
if __name__ == "__main__":
    for k, v in HEX.items():
        print(f"{k:18s} {v}")
