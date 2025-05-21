/**
 * LogPipeline class for handling logging processes with custom metadata
 * @template TArgs - The type of input arguments object
 * @template TMetaData - The type of metadata object
 *
 * @example
 * ```ts
 * // Create a new logging pipeline
 * const userLogger = new LogPipeline()
 *   // Define input argument types
 *   .withArgs<{ userId: string }>()
 *
 *   // Add metadata generators
 *   .withMeta(() => ({ timestamp: Date.now() }))
 *   .withMeta(({ userId }) => ({ user: getUserDetails(userId) }))
 *
 *   // Add loggers
 *   .withLog(({ userId, timestamp, user }) => {
 *     console.log(`User ${user.name} logged in at ${new Date(timestamp).toISOString()}`);
 *   });
 *
 * // Execute the pipeline
 * userLogger.execute({ userId: "123" });
 * ```
 */
export class LogPipeline<const TArgs extends object, const TMetaData extends object> {
  /** Array of functions that generate metadata from args and existing metadata */
  metaDataFns: ((args: TArgs & TMetaData) => Partial<TMetaData>)[] = [];

  /** Array of logger functions that will receive args and metadata */
  loggerFns: ((args: TArgs & TMetaData) => void)[] = [];

  /**
   * Executes the logging pipeline with provided arguments
   * @param args - Initial arguments for the pipeline
   * @returns Combined arguments and metadata
   */
  execute(args: TArgs): TArgs & TMetaData {
    // Generate the meta data for the loggers
    const metaData = this.metaDataFns.reduce(
      (acc, metaDataFn) => {
        Object.assign(acc, metaDataFn(acc));
        return acc;
      },
      args as TArgs & TMetaData,
    );
    // Generate the logs
    for (const log of this.loggerFns) {
      log(metaData);
    }
    return metaData;
  }

  /**
   * Changes the argument type of the pipeline
   * @template TArgs - New argument type
   * @returns A pipeline with updated argument type
   */
  withArgs<const TArgs extends object>(): LogPipeline<TArgs, TMetaData> {
    return this as unknown as LogPipeline<TArgs, TMetaData>;
  }

  /**
   * Adds a metadata generator function to the pipeline
   * @template TNewMetaData - Type of new metadata
   * @param meta - Function that generates new metadata
   * @returns Pipeline with updated metadata type
   */
  withMeta<const TNewMetaData extends object>(
    meta: (args: TArgs & TMetaData) => TNewMetaData,
  ): LogPipeline<TArgs, TMetaData & TNewMetaData> {
    this.metaDataFns.push(meta);
    return this as unknown as LogPipeline<TArgs, TMetaData & TNewMetaData>;
  }

  /**
   * Adds a logging function to the pipeline
   * @param log - Function that performs logging
   * @returns The pipeline instance (for chaining)
   */
  withLog(log: (args: TArgs & TMetaData) => void): this {
    this.loggerFns.push(log);
    return this;
  }
}
