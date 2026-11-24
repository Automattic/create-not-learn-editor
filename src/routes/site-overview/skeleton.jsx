/**
 * A wireframe of a page, pulsing, shown while a card's page loads: a header,
 * a big opening block and lines of text. The same for every page, as it only
 * says something is on its way, not what.
 *
 * @return {Element} Skeleton.
 */
export function ThumbnailSkeleton() {
	return (
		<svg
			aria-hidden
			className="cnl-site-overview-card__skeleton"
			preserveAspectRatio="xMidYMin slice"
			viewBox="0 0 240 150"
		>
			{ /* Header: logo and menu. */ }
			<rect height="6" rx="2" width="28" x="12" y="10" />
			<rect height="4" rx="2" width="16" x="150" y="11" />
			<rect height="4" rx="2" width="16" x="172" y="11" />
			<rect height="4" rx="2" width="16" x="194" y="11" />
			<rect height="6" rx="3" width="18" x="212" y="10" />
			{ /* Opening block: heading and text beside a picture. */ }
			<rect height="10" rx="2" width="92" x="12" y="34" />
			<rect height="10" rx="2" width="70" x="12" y="48" />
			<rect height="4" rx="2" width="96" x="12" y="66" />
			<rect height="4" rx="2" width="84" x="12" y="74" />
			<rect height="8" rx="4" width="32" x="12" y="86" />
			<rect height="68" rx="3" width="100" x="128" y="30" />
			{ /* Text below. */ }
			<rect height="6" rx="2" width="64" x="12" y="114" />
			<rect height="4" rx="2" width="216" x="12" y="126" />
			<rect height="4" rx="2" width="190" x="12" y="134" />
		</svg>
	);
}
