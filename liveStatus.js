module.exports = {
  liveStatus: {},
  setStatus: status => {
    this.liveStatus = status;
  },
  getStatus: () => this.liveStatus
};
