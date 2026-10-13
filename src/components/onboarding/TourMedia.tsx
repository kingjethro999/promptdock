export function TourMedia({
  name,
}: {
  name: "wireframe-composer" | "wireframe-community";
}) {
  if (name === "wireframe-composer") {
    return (
      <div className="tour-media tour-media--composer" aria-hidden="true">
        <div className="tour-media__box">
          <div className="tour-media__bar tour-media__bar--header" />
          <div className="tour-media__bar tour-media__bar--long" />
          <div className="tour-media__bar tour-media__bar--medium" />
          <div className="tour-media__footer">
            <span className="tour-media__pill" />
            <span className="tour-media__btn" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tour-media tour-media--community" aria-hidden="true">
      <div className="tour-media__cards">
        <div className="tour-media__card">
          <div className="tour-media__circle" />
          <div className="tour-media__bar tour-media__bar--card" />
        </div>
        <div className="tour-media__card tour-media__card--active">
          <div className="tour-media__circle" />
          <div className="tour-media__bar tour-media__bar--card" />
        </div>
      </div>
    </div>
  );
}

export default TourMedia;
