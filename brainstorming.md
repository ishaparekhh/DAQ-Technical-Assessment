# Brainstorming

This file is used to document your thoughts, approaches and research conducted across all tasks in the Technical Assessment.

## Firmware

## Spyder


### Stage 2

### Task 1

When I ran the emulator I saw a mix of valid and weird values in the streaming-service logs: symbols like “<” with NUL bytes, very large temperatures like 860, and occasional negative temperatures, alongside normal readings.

The emulator sometimes emits the temperature in a 4-byte integer format that gets JSON-encoded as a string rather than a number. Those raw bytes, when interpreted as little-endian 32-bit integers, convert into regular numbers. When I reviewed the logs, I saw reasonable temperatures like 60 °C, but I also saw impossible magnitudes like 860 °C after conversion. These impossible temperatures should not be passed through to the frontend.

Also, TCP is a raw byte stream, not a message protocol. It does not preserve message boundaries, so JSON objects can be split across chunks or concatenated back-to-back. This explains why data sometimes appears merged or missing if you assume “one chunk equals one JSON”.

I defined “invalid” data as any packet that does not have a finite battery_temperature or where the timestamp is not a finite number. Even if the raw bytes decode into a number, I drop temperatures that are not physically plausible. I used 0–200 °C as a generous plausibility window it filters obvious corruption without being so tight that it clips legitimate test spikes.

To implement this, I added a JSON extractor that scans the incoming TCP stream and assembles complete JSON objects using brace-matching so it is not reliant on newlines. Incomplete byte fragments stay buffered until the remaining bytes arrive, and multiple concatenated objects are split cleanly. I also added a sanitisation step before broadcasting to WebSocket clients. If the temperature and timestamp are finite, I attempt to decode 4-byte strings as little-endian int32, if the resulting temperature is within 0–200 °C, I accept it. Otherwise, I drop the packet.

### Task 3

The connect/disconnect badge should reflect the WebSocket connection state in the UI. It wasn’t updating because the effect that sets the label (“Connected”, “Disconnected”, etc.) ran only once on mount (empty dependency array). When the WebSocket readyState changed, that effect never re-ran, so the badge stayed the same.

To fix this, I made the UI recompute whenever the WebSocket readyState changes by including it in the effect’s dependency array and mapping each state to the correct label.

### Task 4 - Colour

To handle the colour switches based on the battery temp safety, I used semantic Tailwind utility classes defined in global.css: .temp-safe (green), .temp-near (yellow), .temp-unsafe (red) to keep components simple and consistent with the Tailwind/shadcn setup. I didn’t apply cn() or inline style because my approach centralises the visual language in CSS rather than scattering conditional colour string blocks through JSX. It is also easy to change globally later on.

I deliberately didn’t use cn() for conditional class assembly because the components only toggle one of the 3 mutually exclusive classes; rather, a simple variable holding the chosen class keeps the JSX uncluttered from conditional blocks. I also avoided inline style because it shouldn’t be hard-coded per element. Keeping them in Tailwind utilities allows for consistent theming and makes it easier to change in the future.

### Task 4 - 3dp

Also, in numeric.tsx I round the incoming temp to 3dp by using toFixed(3). This means it will always be 3dp regardless of how it is formatted.

### Task 4 - live graph trend

The feature shows a real-time line chart of the battery temperature for the past 60 seconds. It allows users to quickly see trends and oscillations in the battery temperature. On each WebSocket message, I append the new point and trim any data outside the past 60-second range. I rendered the chart using Recharts. I also fixed the domain so that the graph appears stable.

### Task 4 - Toast notification Unsafe Burt Alerts

If the backend detects more than 3 readings out of the safe range within 5 seconds, the UI shows a red toast alert with the time, window, and count. This allows users to see unsafe behaviour immediately. I implemented this by having the backend broadcast a message whenever the sliding window in my streaming service crosses the allowed threshold. On the frontend, I used TypeScript type guards to route messages and trigger alert calls from Sonner.

### Task 4 - Stats Panel
Computed the minimum, maximum, and average over a 60-second time period. It also uses colour to improve readability and presentation. This allows basic statistics to be observed.

### Task 4 - light/dark toggle
Allow for change from light mode to dark.

### Task 4 - live safe-range controls
During runtime, it may be necessary to adjust the limit thresholds in order to intentionally trigger alerts for testing purposes. To support this, I implemented a default button that resets the thresholds to predefined values: a near band of ±5 °C and a safe band of 20–80 °C, as specified in Task 2. This functionality was achieved by clamping the values to the defined ranges, ensuring consistent and predictable behaviour.

## Cloud