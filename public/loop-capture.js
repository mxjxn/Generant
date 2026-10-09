class LoopCapture extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input?.[0]) this.port.postMessage({
      frame: currentFrame,
      channels: input.map(channel => channel.slice()),
    });
    return true;
  }
}

registerProcessor('loop-capture', LoopCapture);
