import React, { FC, useMemo } from 'react';
import { interpolate, Easing } from 'remotion';
import * as d3Geo from 'd3-geo';
import * as topojson from 'topojson-client';
import worldAtlasData from 'world-atlas/countries-110m.json';

export interface GeoPin {
  name: string;
  coord: [number, number]; // [longitude, latitude]
  label?: string;
  type?: 'capital' | 'chokepoint' | 'hub' | 'military' | 'port';
  color?: string;
}

export interface GeoRoute {
  from: [number, number]; // [lon, lat]
  to: [number, number];   // [lon, lat]
  fromName?: string;
  toName?: string;
  label?: string;
  type?: 'flight' | 'maritime' | 'supply' | 'intelligence';
  color?: string;
}

export interface CinematicVectorMapProps {
  sceneFrame: number;
  durationFrames?: number;
  projectionType?: 'naturalEarth' | 'mercator' | 'orthographic';
  centerCoord?: [number, number];
  zoomScale?: number;
  highlightedCountries?: string[];
  pins?: GeoPin[];
  routes?: GeoRoute[];
  regionTitle?: string;
  tacticalHud?: boolean;
  theme?: 'tactical_navy' | 'amber_espionage' | 'emerald_intelligence';
}

// Built-in coordinate catalog for key global geopolitical and tech epicenters
export const GLOBAL_GEO_CATALOG: Record<string, { coord: [number, number]; country: string; label: string }> = {
  'silicon valley': { coord: [-122.0838, 37.3861], country: 'United States of America', label: 'SILICON VALLEY TECH HUB' },
  'washington': { coord: [-77.0369, 38.9072], country: 'United States of America', label: 'WASHINGTON D.C. PENTAGON' },
  'wall street': { coord: [-74.0060, 40.7128], country: 'United States of America', label: 'WALL STREET FINANCIAL DESK' },
  'taipei': { coord: [121.5654, 25.0330], country: 'Taiwan', label: 'TSMC ADVANCED FAB TSMC' },
  'taiwan strait': { coord: [119.5, 24.0], country: 'Taiwan', label: 'TAIWAN STRAIT MARITIME CHOKEPOINT' },
  'beijing': { coord: [116.4074, 39.9042], country: 'China', label: 'BEIJING COMMAND' },
  'shenzhen': { coord: [114.0579, 22.5431], country: 'China', label: 'SHENZHEN HARDWARE HUB' },
  'singapore': { coord: [103.8198, 1.3521], country: 'Singapore', label: 'MALACCA STRAIT GATEWAY' },
  'new delhi': { coord: [77.2090, 28.6139], country: 'India', label: 'NEW DELHI STRATEGIC COMMAND' },
  'bengaluru': { coord: [77.5946, 12.9716], country: 'India', label: 'BENGALURU SILICON CORRIDOR' },
  'mumbai': { coord: [72.8777, 19.0760], country: 'India', label: 'MUMBAI FINANCIAL CAPITAL' },
  'london': { coord: [-0.1276, 51.5074], country: 'United Kingdom', label: 'LONDON COMMODITIES & INTEL' },
  'berlin': { coord: [13.4050, 52.5200], country: 'Germany', label: 'BERLIN EU GOVERNANCE' },
  'tokyo': { coord: [139.6917, 35.6895], country: 'Japan', label: 'TOKYO SILICON R&D' },
  'seoul': { coord: [126.9780, 37.5665], country: 'South Korea', label: 'SEOUL MEMORY SEMICONDUCTOR' },
  'kyiv': { coord: [30.5234, 50.4501], country: 'Ukraine', label: 'KYIV CONFLICT THEATER' },
  'moscow': { coord: [37.6173, 55.7558], country: 'Russia', label: 'MOSCOW KREMLIN' },
  'strait of hormuz': { coord: [56.45, 26.56], country: 'Iran', label: 'STRAIT OF HORMUZ ENERGY CHOKEPOINT' },
  'suez canal': { coord: [32.34, 30.58], country: 'Egypt', label: 'SUEZ CANAL GLOBAL SUPPLY LINE' },
  'dubai': { coord: [55.2708, 25.2048], country: 'United Arab Emirates', label: 'DUBAI LOGISTICS TERMINAL' },
};

// Aliases for country matching against Natural Earth properties.name
const COUNTRY_ALIAS_MAP: Record<string, string> = {
  us: 'United States of America',
  usa: 'United States of America',
  'united states': 'United States of America',
  america: 'United States of America',
  cn: 'China',
  china: 'China',
  prc: 'China',
  tw: 'Taiwan',
  taiwan: 'Taiwan',
  in: 'India',
  india: 'India',
  bharat: 'India',
  ru: 'Russia',
  russia: 'Russia',
  'russian federation': 'Russia',
  ua: 'Ukraine',
  ukraine: 'Ukraine',
  uk: 'United Kingdom',
  'united kingdom': 'United Kingdom',
  britain: 'United Kingdom',
  gb: 'United Kingdom',
  de: 'Germany',
  germany: 'Germany',
  jp: 'Japan',
  japan: 'Japan',
  kr: 'South Korea',
  korea: 'South Korea',
  'south korea': 'South Korea',
  sg: 'Singapore',
  singapore: 'Singapore',
  ir: 'Iran',
  iran: 'Iran',
  il: 'Israel',
  israel: 'Israel',
  sa: 'Saudi Arabia',
  'saudi arabia': 'Saudi Arabia',
  eg: 'Egypt',
  egypt: 'Egypt',
  fr: 'France',
  france: 'France',
};

export const CinematicVectorMap: FC<CinematicVectorMapProps> = ({
  sceneFrame,
  durationFrames = 180,
  projectionType = 'naturalEarth',
  centerCoord = [20, 20],
  zoomScale = 1.0,
  highlightedCountries = ['United States of America', 'China', 'Taiwan'],
  pins,
  routes,
  regionTitle = 'GLOBAL STRATEGIC SURVEILLANCE',
  tacticalHud = true,
  theme = 'tactical_navy',
}) => {
  // 1. Theme Configuration
  const themeColors = useMemo(() => {
    switch (theme) {
      case 'amber_espionage':
        return {
          bgGradStart: '#140c06',
          bgGradEnd: '#070402',
          landFill: '#241a10',
          landStroke: '#3a2b1c',
          graticule: 'rgba(245, 158, 11, 0.08)',
          highlightFill: 'rgba(245, 158, 11, 0.35)',
          highlightStroke: '#f59e0b',
          glow: 'rgba(245, 158, 11, 0.65)',
          routeLine: '#fbbf24',
          accent: '#f59e0b',
        };
      case 'emerald_intelligence':
        return {
          bgGradStart: '#04130c',
          bgGradEnd: '#020906',
          landFill: '#0f261c',
          landStroke: '#193f2f',
          graticule: 'rgba(16, 185, 129, 0.08)',
          highlightFill: 'rgba(16, 185, 129, 0.32)',
          highlightStroke: '#10b981',
          glow: 'rgba(16, 185, 129, 0.65)',
          routeLine: '#34d399',
          accent: '#10b981',
        };
      case 'tactical_navy':
      default:
        return {
          bgGradStart: '#081122',
          bgGradEnd: '#030711',
          landFill: '#111e33',
          landStroke: '#1d2f4d',
          graticule: 'rgba(56, 189, 248, 0.09)',
          highlightFill: 'rgba(56, 189, 248, 0.28)',
          highlightStroke: '#38bdf8',
          glow: 'rgba(56, 189, 248, 0.75)',
          routeLine: '#38bdf8',
          accent: '#38bdf8',
        };
    }
  }, [theme]);

  // 2. Extract TopoJSON Features
  const { countriesGeo, graticuleGeo } = useMemo(() => {
    const countries = topojson.feature(
      worldAtlasData as any,
      (worldAtlasData as any).objects.countries
    ) as any;
    const graticule = d3Geo.geoGraticule10();
    return { countriesGeo: countries, graticuleGeo: graticule };
  }, []);

  // 3. Normalize Highlighted Countries
  const normalizedHighlights = useMemo(() => {
    const set = new Set<string>();
    highlightedCountries.forEach((c) => {
      const low = c.trim().toLowerCase();
      const mapped = COUNTRY_ALIAS_MAP[low] || c.trim();
      set.add(mapped.toLowerCase());
    });
    return set;
  }, [highlightedCountries]);

  // 4. Default Pins & Routes if not provided
  const activePins: GeoPin[] = useMemo(() => {
    if (pins && pins.length > 0) return pins;
    return [
      { name: 'Silicon Valley, CA', coord: [-122.0838, 37.3861], label: 'AI COMPUTE FOUNDRY', type: 'hub' },
      { name: 'Taipei, TW', coord: [121.5654, 25.0330], label: 'ADVANCED SILICON 3NM', type: 'chokepoint' },
      { name: 'Washington D.C.', coord: [-77.0369, 38.9072], label: 'STRATEGIC EXPORT CONTROLS', type: 'capital' },
    ];
  }, [pins]);

  const activeRoutes: GeoRoute[] = useMemo(() => {
    if (routes && routes.length > 0) return routes;
    return [
      {
        from: [-122.0838, 37.3861],
        to: [121.5654, 25.0330],
        fromName: 'SAN FRANCISCO',
        toName: 'TAIPEI',
        label: 'PACIFIC SILICON SUPPLY ARTERY',
        type: 'flight',
      },
    ];
  }, [routes]);

  // 5. Cinematic Pan & Zoom Progression
  const cameraDrift = interpolate(sceneFrame, [0, durationFrames], [0, 1], {
    easing: Easing.out(Easing.quad),
  });

  const animatedCenter: [number, number] = useMemo(() => {
    const startLon = centerCoord[0];
    const startLat = centerCoord[1];
    // Gentle 3-degree cinematic pan across longitude
    const curLon = startLon + cameraDrift * 3.5;
    const curLat = startLat - cameraDrift * 1.2;
    return [curLon, curLat];
  }, [centerCoord, cameraDrift]);

  const baseScale = 290 * zoomScale * (1 + cameraDrift * 0.08);

  // 6. D3-Geo Projection & Path Generator
  const { projection, pathGenerator } = useMemo(() => {
    let proj: d3Geo.GeoProjection;
    if (projectionType === 'mercator') {
      proj = d3Geo.geoMercator();
    } else if (projectionType === 'orthographic') {
      proj = d3Geo.geoOrthographic();
    } else {
      proj = d3Geo.geoNaturalEarth1();
    }

    proj
      .scale(baseScale)
      .center(animatedCenter)
      .translate([960, 540]);

    const path = d3Geo.geoPath().projection(proj);
    return { projection: proj, pathGenerator: path };
  }, [projectionType, baseScale, animatedCenter]);

  // 7. Route Geodesic Interpolation & Metrics
  const animatedRoutesData = useMemo(() => {
    const routeProgress = interpolate(sceneFrame, [10, Math.min(durationFrames - 15, 110)], [0, 1], {
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    return activeRoutes.map((route) => {
      const interpolator = d3Geo.geoInterpolate(route.from, route.to);
      const totalDistKm = Math.round(d3Geo.geoDistance(route.from, route.to) * 6371);
      const totalDistMiles = Math.round(totalDistKm * 0.621371);
      const currentDistKm = Math.round(totalDistKm * routeProgress);

      // Tangent angle calculation at current point
      const p = Math.max(0.01, Math.min(0.99, routeProgress));
      const p1 = interpolator(Math.max(0, p - 0.015));
      const p2 = interpolator(Math.min(1, p + 0.015));
      const pt1 = projection(p1) || [0, 0];
      const pt2 = projection(p2) || [0, 0];
      const angle = (Math.atan2(pt2[1] - pt1[1], pt2[0] - pt1[0]) * 180) / Math.PI;

      // Sample sliced points along geodesic curve for smooth animated SVG line
      const sampleCount = Math.max(2, Math.floor(routeProgress * 60));
      const sampledCoords: [number, number][] = [];
      for (let i = 0; i <= sampleCount; i++) {
        const step = (i / 60) * routeProgress;
        sampledCoords.push(interpolator(step));
      }

      // GeoJSON LineString of active path
      const activeLineGeo: any = {
        type: 'LineString',
        coordinates: sampledCoords,
      };

      // Full line for faint backdrop trajectory
      const fullLineCoords: [number, number][] = [];
      for (let i = 0; i <= 60; i++) {
        fullLineCoords.push(interpolator(i / 60));
      }
      const fullLineGeo: any = {
        type: 'LineString',
        coordinates: fullLineCoords,
      };

      const currentCoord = interpolator(p);
      const currentScreenPos = projection(currentCoord) || [960, 540];
      const startScreenPos = projection(route.from) || [960, 540];
      const endScreenPos = projection(route.to) || [960, 540];

      return {
        ...route,
        totalDistKm,
        totalDistMiles,
        currentDistKm,
        routeProgress,
        angle,
        activePathD: pathGenerator(activeLineGeo) || '',
        fullPathD: pathGenerator(fullLineGeo) || '',
        currentPos: currentScreenPos,
        startPos: startScreenPos,
        endPos: endScreenPos,
      };
    });
  }, [activeRoutes, sceneFrame, durationFrames, projection, pathGenerator]);

  // Pulse & Radar Scan Timing
  const radarSweep = (sceneFrame * 2.8) % 360;
  const pulseRadius = (sceneFrame % 50) * 2.2;
  const pulseOpacity = interpolate(sceneFrame % 50, [0, 50], [0.85, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#030712',
        overflow: 'hidden',
        fontFamily: "'JetBrains Mono', 'SF Pro Display', -apple-system, sans-serif",
      }}
    >
      <svg
        viewBox="0 0 1920 1080"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      >
        <defs>
          {/* Deep Oceanic Backdrop */}
          <linearGradient id="oceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={themeColors.bgGradStart} />
            <stop offset="50%" stopColor="#050a17" />
            <stop offset="100%" stopColor={themeColors.bgGradEnd} />
          </linearGradient>

          {/* Glowing Filters */}
          <filter id="vectorGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Tactical HUD Grid */}
          <pattern id="tacticalGrid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(56, 189, 248, 0.04)" strokeWidth="1" />
            <circle cx="32" cy="32" r="1" fill="rgba(56, 189, 248, 0.12)" />
          </pattern>
        </defs>

        {/* 1. Base Ocean & Grid Background */}
        <rect width="1920" height="1080" fill="url(#oceanGrad)" />
        <rect width="1920" height="1080" fill="url(#tacticalGrid)" />

        {/* 2. Graticule (Lat/Lon Coordinates Lines) */}
        <path
          d={pathGenerator(graticuleGeo) || ''}
          fill="none"
          stroke={themeColors.graticule}
          strokeWidth="0.8"
          strokeDasharray="4 4"
        />

        {/* 3. Global Natural Earth Countries */}
        <g id="worldCountries">
          {countriesGeo.features.map((feature: any, idx: number) => {
            const countryName = feature.properties?.name || '';
            const isHighlighted = normalizedHighlights.has(countryName.toLowerCase());
            const d = pathGenerator(feature);
            if (!d) return null;

            return (
              <path
                key={`cntry_${feature.id || idx}`}
                d={d}
                fill={isHighlighted ? themeColors.highlightFill : themeColors.landFill}
                stroke={isHighlighted ? themeColors.highlightStroke : themeColors.landStroke}
                strokeWidth={isHighlighted ? 2.0 : 0.9}
                style={{
                  transition: 'fill 0.4s ease, stroke 0.4s ease',
                  filter: isHighlighted ? `drop-shadow(0 0 12px ${themeColors.glow})` : undefined,
                }}
              />
            );
          })}
        </g>

        {/* 4. Animated Great-Circle Routes */}
        <g id="geodesicRoutes">
          {animatedRoutesData.map((route, rIdx) => {
            return (
              <g key={`route_${rIdx}`}>
                {/* Background Full Trajectory Track (Faint Dashed) */}
                <path
                  d={route.fullPathD}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.12)"
                  strokeWidth="2"
                  strokeDasharray="5 6"
                />

                {/* Active Geodesic Line (Bright Animated) */}
                <path
                  d={route.activePathD}
                  fill="none"
                  stroke={route.color || themeColors.routeLine}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#routeGlow)"
                />

                {/* Start City Pulse Marker */}
                <circle cx={route.startPos[0]} cy={route.startPos[1]} r="5" fill="#38bdf8" />
                <circle
                  cx={route.startPos[0]}
                  cy={route.startPos[1]}
                  r={pulseRadius}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                  opacity={pulseOpacity}
                />

                {/* End City Destination Marker */}
                <circle cx={route.endPos[0]} cy={route.endPos[1]} r="6" fill="#ef4444" />
                <circle
                  cx={route.endPos[0]}
                  cy={route.endPos[1]}
                  r={pulseRadius * 1.2}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2"
                  opacity={pulseOpacity}
                />

                {/* Moving Marker (Airplane / Vessel / Kinetic Probe) */}
                {route.routeProgress > 0 && route.routeProgress < 1 && (
                  <g
                    transform={`translate(${route.currentPos[0]}, ${route.currentPos[1]}) rotate(${route.angle})`}
                  >
                    {route.type === 'maritime' ? (
                      /* Cargo Vessel / Naval Vessel Icon */
                      <g transform="translate(-14, -8) scale(0.9)">
                        <polygon points="0,8 6,2 24,2 28,8 24,14 6,14" fill="#ffffff" />
                        <rect x="10" y="4" width="8" height="8" fill="#38bdf8" />
                      </g>
                    ) : (
                      /* Supersonic Flight Aircraft Icon */
                      <g transform="translate(-16, -16) scale(1.1)">
                        <path
                          d="M 16,3 L 19,13 L 29,18 L 29,21 L 19,18 L 18,27 L 22,29 L 22,31 L 16,30 L 10,31 L 10,29 L 14,27 L 13,18 L 3,21 L 3,18 L 13,13 Z"
                          fill="#ffffff"
                          filter="drop-shadow(0 0 6px rgba(255, 255, 255, 0.9))"
                        />
                      </g>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* 5. Strategic Geo Pins with Telemetry Cards */}
        <g id="geoPins">
          {activePins.map((pin, pIdx) => {
            const screenPt = projection(pin.coord);
            if (!screenPt) return null;
            const [px, py] = screenPt;

            return (
              <g key={`pin_${pIdx}`} transform={`translate(${px}, ${py})`}>
                {/* Center Pin Radar Pulse */}
                <circle cx="0" cy="0" r="4.5" fill={pin.color || themeColors.accent} />
                <circle
                  cx="0"
                  cy="0"
                  r={pulseRadius}
                  fill="none"
                  stroke={pin.color || themeColors.accent}
                  strokeWidth="1.2"
                  opacity={pulseOpacity}
                />

                {/* Telemetry Tag Box */}
                <g transform="translate(14, -28)">
                  <rect
                    x="0"
                    y="0"
                    width="230"
                    height="38"
                    rx="4"
                    fill="rgba(8, 14, 26, 0.88)"
                    stroke="rgba(56, 189, 248, 0.4)"
                    strokeWidth="1"
                    style={{ backdropFilter: 'blur(8px)' }}
                  />
                  <line x1="0" y1="0" x2="3" y2="38" stroke={pin.color || themeColors.accent} strokeWidth="3" />
                  <text
                    x="12"
                    y="16"
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="700"
                    letterSpacing="0.8px"
                  >
                    {pin.name.toUpperCase()}
                  </text>
                  <text
                    x="12"
                    y="30"
                    fill={themeColors.accent}
                    fontSize="9.5"
                    fontWeight="600"
                    letterSpacing="0.5px"
                  >
                    {pin.label || `${pin.coord[1].toFixed(2)}°N, ${pin.coord[0].toFixed(2)}°E`}
                  </text>
                </g>
              </g>
            );
          })}
        </g>

        {/* 6. Tactical Telemetry HUD Overlays */}
        {tacticalHud && (
          <g id="tacticalHudElements">
            {/* Top Left: Operational Theater & Coordinates */}
            <g transform="translate(48, 48)">
              <rect
                x="0"
                y="0"
                width="380"
                height="68"
                rx="6"
                fill="rgba(5, 9, 20, 0.85)"
                stroke="rgba(56, 189, 248, 0.25)"
                strokeWidth="1.2"
              />
              <circle cx="20" cy="24" r="5" fill="#10b981" />
              <text x="34" y="27" fill="#ffffff" fontSize="13" fontWeight="800" letterSpacing="1.2px">
                {regionTitle.toUpperCase()}
              </text>
              <text x="34" y="48" fill="rgba(148, 163, 184, 0.9)" fontSize="10.5" letterSpacing="0.8px">
                PROJ: NATURAL EARTH 110M • RES: HIGH-PRECISION GIS
              </text>
            </g>

            {/* Top Right: Real-time Geodesic Odometer / Telemetry */}
            {animatedRoutesData.length > 0 && (
              <g transform="translate(1420, 48)">
                <rect
                  x="0"
                  y="0"
                  width="450"
                  height="78"
                  rx="6"
                  fill="rgba(5, 9, 20, 0.85)"
                  stroke="rgba(56, 189, 248, 0.25)"
                  strokeWidth="1.2"
                />
                <text x="24" y="28" fill="rgba(148, 163, 184, 0.9)" fontSize="10.5" fontWeight="600">
                  GEODESIC TRANSIT CORRIDOR
                </text>
                <text x="24" y="54" fill="#38bdf8" fontSize="20" fontWeight="900" letterSpacing="1px">
                  {animatedRoutesData[0].currentDistKm.toLocaleString()} KM{' '}
                  <tspan fill="rgba(255, 255, 255, 0.6)" fontSize="14" fontWeight="600">
                    / {animatedRoutesData[0].totalDistKm.toLocaleString()} KM
                  </tspan>
                </text>
                <text x="24" y="70" fill="#f59e0b" fontSize="9.5" fontWeight="700">
                  GREAT-CIRCLE BEARING: {animatedRoutesData[0].angle.toFixed(1)}° • TSMC CORRIDOR
                </text>
              </g>
            )}

            {/* Bottom Right: Tactical Compass Rose */}
            <g transform="translate(1810, 970)">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(56, 189, 248, 0.2)" strokeWidth="1" />
              <line x1="40" y1="12" x2="40" y2="68" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1" />
              <line x1="12" y1="40" x2="68" y2="40" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1" />
              <polygon points="40,16 36,26 44,26" fill="#ef4444" />
              <text x="40" y="10" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="800">
                N
              </text>
            </g>

            {/* Bottom Left: Sourced Geopolitical Data Ledger */}
            <g transform="translate(48, 990)">
              <text x="0" y="0" fill="rgba(148, 163, 184, 0.65)" fontSize="10" letterSpacing="0.8px">
                BOUNDARY SOURCE: NATURAL EARTH 1:110M DATASET • PROJECTION: D3-GEO SPHERICAL PROJECTION
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
};

export default CinematicVectorMap;
