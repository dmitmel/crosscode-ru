// again, I have to copy the whole type signature, because I can't use names of
// the generics otherwise... well, at least I'll get an error if I update only
// one of the signatures.
sc.ui2.waitForLoadable = <T extends ig.Loadable | ig.SingleLoadable>(
  loadable: T,
): Promise<T> => {
  return new Promise((resolve, reject) => {
    if (loadable.loaded) {
      resolve(loadable);
      return;
    }

    let loadingFinished = loadable.loadingFinished as (
      this: T,
      success: boolean,
    ) => void;
    loadable.loadingFinished = function(this: T, success: boolean): void {
      try {
        loadingFinished.call(this, success);
      } catch (err) {
        reject(err);
      }
      if (success) resolve(loadable);
      else reject(new Error(`Failed to load resource: ${this.path}`));
    };
  });
};