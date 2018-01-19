// module.exports = {
//   parentEv: {
//     errorMessaging: 'PARENT_COMMUNICATION_ERROR',
//     buildFinished: 'BUILD_FINISHED',
//     buildFailed: 'BUILED_FAILED',
//   },
//   forkEv: {
//     errorMessaging: 'PARENT_COMMUNICATION_ERROR',
//     requestBuild: 'REQUEST_BUILD',
//   },
// };

module.exports = {
  requestBuild: 'REQUEST_BUILD',

  buildFinished: 'BUILD_FINISHED',
  buildFailed: 'BUILD_FAILED',

  errorMessaging: 'COMMUNICATION_ERROR',
};
