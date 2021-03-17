import { isUndefined } from 'lodash';
import moment from 'moment';
import React, { useEffect, useState } from 'react';
import ReactApexChart from 'react-apexcharts';

import { API } from '../../api';
import { AHStats } from '../../types';
import compoundErrorMessage from '../../utils/compoundErrorMessage';
import prettifyNumber from '../../utils/prettifyNumber';
import Loading from '../common/Loading';
import NoData from '../common/NoData';
import styles from './StatsView.module.css';

const getAreaChartConfig = (title: string, withAnnotations?: boolean) => {
  const annotations: any[] = withAnnotations
    ? [
        {
          x: new Date('7 Oct 2020').getTime(),
          strokeDashArray: 0,
          borderColor: 'var(--color-1-700)',
          label: {
            borderColor: 'var(--color-1-700)',
            style: {
              color: '#fff',
              background: 'var(--color-1-700)',
            },
            text: 'Helm Hub ⇒ Artifact Hub',
          },
        },
      ]
    : [];

  return {
    chart: {
      fontFamily: "'Lato', Roboto, 'Helvetica Neue', Arial, sans-serif !default",
      height: 300,
      type: 'area',
      zoom: {
        type: 'x',
        enabled: true,
        autoScaleYaxis: true,
        zoomedArea: {
          fill: {
            color: 'var(--color-1-300)',
            opacity: 0.4,
          },
          stroke: {
            color: 'var(--color-1-900)',
            opacity: 0.8,
            width: 1,
          },
        },
      },
      toolbar: {
        autoSelected: 'zoom',
        tools: {
          download: false,
          pan: false,
        },
      },
      events: {
        beforeZoom: (chartContext: any, opt: any) => {
          const minDate = chartContext.ctx.data.twoDSeriesX[0];
          const maxDate = chartContext.ctx.data.twoDSeriesX[chartContext.ctx.data.twoDSeriesX.length - 1];
          return {
            xaxis: {
              min: opt.xaxis.min < minDate ? minDate : opt.xaxis.min,
              max: opt.xaxis.max > maxDate ? maxDate : opt.xaxis.max,
            },
          };
        },
      },
    },
    grid: { borderColor: 'var(--border-md)' },
    annotations: {
      xaxis: annotations,
    },
    dataLabels: {
      enabled: false,
    },
    colors: ['var(--color-1-500)'],
    stroke: {
      curve: 'smooth',
    },
    fill: {
      opacity: 0,
      colors: [
        () => {
          return '#659dbd';
        },
      ],
    },
    title: {
      text: title,
      align: 'left',
      style: {
        color: 'var(--color-font)',
      },
    },
    xaxis: {
      type: 'datetime',
      labels: {
        style: {
          colors: 'var(--color-font)',
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: ['var(--color-font)'],
        },
      },
    },
    markers: {
      size: 0,
      style: 'hollow',
    },
  };
};

const getBarChartConfig = (title: string) => {
  return {
    chart: {
      height: 300,
      type: 'bar',
      fontFamily: "'Lato', Roboto, 'Helvetica Neue', Arial, sans-serif !default",
      toolbar: {
        show: false,
      },
    },
    grid: { borderColor: 'var(--border-md)' },
    plotOptions: {
      bar: {
        borderRadius: 5,
        dataLabels: {
          position: 'top',
        },
      },
    },
    dataLabels: {
      enabled: true,
      offsetY: -20,
      style: {
        fontSize: '12px',
        colors: ['var(--color-font)'],
      },
      formatter: (value: number) => {
        return prettifyNumber(value);
      },
    },
    colors: ['var(--color-1-500)'],
    xaxis: {
      type: 'datetime',
      position: 'bottom',
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      tooltip: {
        enabled: true,
      },
      labels: {
        format: `MM/yy`,
        style: {
          colors: 'var(--color-font)',
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: 'var(--color-font)',
        },
      },
    },
    tooltip: {
      x: {
        format: `MMM'yy`,
      },
    },
    title: {
      text: title,
      style: {
        color: 'var(--color-font)',
      },
    },
    responsive: [
      {
        breakpoint: 1920,
        options: {
          plotOptions: {
            bar: {
              columnWidth: '80%',
            },
          },
          dataLabels: {
            offsetY: -15,
            style: {
              fontSize: '9px',
            },
          },
        },
      },
    ],
  };
};

const StatsView = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<AHStats | null | undefined>(undefined);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    async function getStats() {
      try {
        setIsLoading(true);
        setStats(await API.getAHStats());
        setApiError(null);
        setIsLoading(false);
      } catch (err) {
        setIsLoading(false);
        let error = compoundErrorMessage(err, 'An error occurred getting Artifact Hub stats');
        setApiError(error);
        setStats(null);
      }
    }
    getStats();
  }, []); /* eslint-disable-line react-hooks/exhaustive-deps */

  return (
    <div className="d-flex flex-column flex-grow-1 position-relative">
      {(isUndefined(stats) || isLoading) && <Loading />}

      <main role="main" className="container-lg px-sm-4 px-lg-0 py-5">
        <div className={`flex-grow-1 position-relative ${styles.wrapper}`}>
          <div className={`h2 text-secondary text-center ${styles.title}`}>Artifact Hub Stats</div>

          {apiError && <NoData issuesLinkVisible>{apiError}</NoData>}

          {stats && (
            <>
              <div className="text-center mb-5">
                <small>
                  <span className="text-muted mr-2">Report generated at:</span>
                  {moment(stats.generatedAt).format('YYYY/MM/DD HH:mm:ss (Z)')}
                </small>
              </div>
              <div className={`h3 mb-4 font-weight-bold ${styles.title}`}>Packages and releases</div>

              <div className="row my-4 pb-0 pb-lg-4">
                {stats.packages.runningTotal && (
                  <div className="col-12 col-lg-6">
                    <div className="pr-0 pr-lg-3 pr-xxl-4 mt-4 mb-4 mb-lg-0">
                      <div className={`card ${styles.chartWrapper}`}>
                        <ReactApexChart
                          options={getAreaChartConfig('Packages available')}
                          series={[{ name: 'Packages', data: stats.packages.runningTotal }]}
                          type="area"
                          height={300}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {stats.snapshots.runningTotal && (
                  <div className="col-12 col-lg-6">
                    <div className="pl-0 pl-lg-3 pl-xxl-4 mt-4">
                      <div className={`card ${styles.chartWrapper}`}>
                        <ReactApexChart
                          options={getAreaChartConfig('Releases available')}
                          series={[{ name: 'Releases', data: stats.snapshots.runningTotal }]}
                          type="area"
                          height={300}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="row my-4 pb-4">
                {stats.packages.createdMonthly && (
                  <div className="col-12 col-lg-6">
                    <div className="pr-0 pr-lg-3 pr-xxl-4 mt-4 mb-4 mb-lg-0">
                      <div className={`card ${styles.chartWrapper}`}>
                        <ReactApexChart
                          options={getBarChartConfig('New packages added monthly')}
                          series={[
                            {
                              name: 'Packages',
                              data: stats.packages.createdMonthly,
                            },
                          ]}
                          type="bar"
                          height={300}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {stats.snapshots.createdMonthly && (
                  <div className="col-12 col-lg-6">
                    <div className="pl-0 pl-lg-3 pl-xxl-4 mt-4">
                      <div className={`card ${styles.chartWrapper}`}>
                        <ReactApexChart
                          options={getBarChartConfig('New releases added monthly')}
                          series={[
                            {
                              name: 'Releases',
                              data: stats.snapshots.createdMonthly,
                            },
                          ]}
                          type="bar"
                          height={300}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {stats.repositories.runningTotal && (
                <>
                  <div className={`h3 my-4 font-weight-bold ${styles.title}`}>Repositories</div>

                  <div className="row my-4">
                    <div className="col-12 my-4">
                      <div className={`card ${styles.chartWrapper}`}>
                        <ReactApexChart
                          options={getAreaChartConfig('Registered repositories')}
                          series={[{ name: 'Repositories', data: stats.repositories.runningTotal }]}
                          type="area"
                          height={300}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className={`h3 mt-4 font-weight-bold ${styles.title}`}>Organizations and users</div>

              <div className="row my-4">
                {stats.organizations.runningTotal && (
                  <div className="col-12 col-lg-6 pt-4">
                    <div className="pr-0 pr-lg-3 pr-xxl-4">
                      <div className={`card ${styles.chartWrapper}`}>
                        <ReactApexChart
                          options={getAreaChartConfig('Registered organizations', true)}
                          series={[
                            {
                              name: 'Organizations',
                              data: stats.organizations.runningTotal,
                            },
                          ]}
                          type="area"
                          height={300}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {stats.users.runningTotal && (
                  <div className="col-12 col-lg-6 pt-4">
                    <div className="pl-0 pl-lg-3 pl-xxl-4">
                      <div className={`card ${styles.chartWrapper}`}>
                        <ReactApexChart
                          options={getAreaChartConfig('Registered users', true)}
                          series={[
                            {
                              name: 'Users',
                              data: stats.users.runningTotal,
                            },
                          ]}
                          type="area"
                          height={300}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default StatsView;