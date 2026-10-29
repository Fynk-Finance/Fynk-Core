// Decorative squares and the moving shine of the header, copied from the design (Login.html).
// `slice` keeps the art covering the column on any phone width and height.
export function FynkHeaderArt() {
  return (
    <svg
      className="fk-art"
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
    >
      <rect
        data-shape
        className="fk-art-shape-a"
        x="226"
        y="-86"
        width="230"
        height="230"
        rx="52"
      />
      <rect
        data-shape
        className="fk-art-shape-b"
        x="296"
        y="-30"
        width="116"
        height="116"
        rx="28"
      />
      <rect
        data-shape
        className="fk-art-shape-c"
        x="-70"
        y="196"
        width="170"
        height="170"
        rx="40"
      />
      <rect data-shape className="fk-art-shape-a" x="40" y="150" width="58" height="58" rx="16" />
      <rect data-shape className="fk-art-shape-c" x="300" y="236" width="74" height="74" rx="20" />
      <g className="fk-shine">
        <rect
          x="-140"
          y="-40"
          width="56"
          height="460"
          fill="#ffffff"
          fillOpacity=".12"
          transform="skewX(-18)"
        />
      </g>
    </svg>
  );
}
