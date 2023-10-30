import useSWR from 'swr'
import {
    HelpCircle,
    Circle,
} from "lucide-react"
import {
    bytesToSize,
    pluralize,
    pluralizeWithCount,
    fetcher,
    stripPrefix,
    HealthchecksioCheck,
    HealthchecksioCheckProcessed,
    UnionOfElementTypes,
} from "@/lib/utils"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Pre, Code } from "nextra/components"
import { Link } from "nextra-theme-docs"
import { MachineInfo, websiteConfig } from '@/lib/data'
import { hostnameSorter } from '@/lib/wato-utils'

export function MachineCard({
    machine,
    isVM,
}: {
    machine: UnionOfElementTypes<MachineInfo>,
    isVM: boolean,
}) {
    const { data, error, isLoading } : {
        data?: HealthchecksioCheckProcessed[],
        error?: any,
        isLoading?: boolean,
    } = useSWR(
        [`https://healthchecks.io/api/v2/checks/`, websiteConfig.healthchecksio_read_key],
        ([url, key]) => fetcher(url, {
            headers: {
                'X-Api-Key': key,
            },
        }).then(data => data['checks'].map((check: HealthchecksioCheck) => ({
                ...check,
                tags: check['tags'].split(' ')
        }))),
        {
            refreshInterval: 10000, // milliseconds
        }
    )

    const machineChecks = data?.filter(check => check.tags.includes(`host=${machine.name}`) && check.tags.includes(`public=True`))

    let machineHealthColor;
    let machineHealthDescription;
    if (machineChecks?.length) {
        if (machineChecks.every(check => check.status === "down")) {
            machineHealthColor = "red"
            machineHealthDescription = `${machine.name} is down`
        } else if (machineChecks.every(check => ["up","grace"].includes(check.status))) {
            machineHealthColor = "green"
            machineHealthDescription = `${machine.name} is healthy`
        } else {
            machineHealthColor = "orange"
            machineHealthDescription = `${machine.name} is partially down`
        }
    } else if (isLoading) {
        machineHealthColor = "gray"
        machineHealthDescription = `Loading health status for ${machine.name}...`
    } else if (error) {
        machineHealthColor = "gray"
        machineHealthDescription = `Error getting health status for ${machine.name}`
    } else {
        machineHealthColor = "gray"
        machineHealthDescription = `${machine.name} did not report any health information`
    }

    const machineHealthSummary = machineChecks?.length ? (
        <Table>
            <TableBody>
                {machineChecks.map((check) => {
                    const indicatorColor =
                        check.status === "down"
                            ? "red"
                            : ["up", "grace"].includes(check.status)
                            ? "green"
                            : "gray";
                    return (
                        <TableRow key={check.slug} className="hover:bg-inherit border-b-0">
                            <TableCell className="p-0.5">
                                {stripPrefix(check.name, `${machine.name}-`)}
                            </TableCell>
                            <TableCell className="p-0.5">
                                <Circle
                                    size="10"
                                    className="inline-flex mr-2 my-0.5"
                                    fill={indicatorColor}
                                    color={indicatorColor}
                                />
                                {check.status}
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    ) : null;

    return (
        <Card>
            <CardHeader>
            <CardTitle>
                {machine.name}
                <Popover>
                    <PopoverTrigger>
                        <Circle size="10" className="inline-flex align-baseline ml-2 my-0.5" fill={machineHealthColor} color={machineHealthColor} />
                    </PopoverTrigger>
                    <PopoverContent side="top">
                        <p>{machineHealthDescription}</p>
                        {machineHealthSummary}
                    </PopoverContent>
                </Popover>
                { isVM ? (
                    <Popover>
                        <PopoverTrigger><Badge className="mx-2 my-1 align-text-top">VM</Badge></PopoverTrigger>
                        <PopoverContent side="top">{machine.name} is a virtual machine</PopoverContent>
                    </Popover>
                ): undefined}
            </CardTitle>
            <CardDescription>{
                `${pluralizeWithCount(parseInt(machine.cpu_info['logical_processors']), "CPU")}`
                + `, ${bytesToSize(parseInt(machine.memory_info["memory_total_kibibytes"])*1024, 0)} RAM`
                + ('gpus' in machine && machine.gpus?.length ? `, ${pluralizeWithCount(machine.gpus.length, "GPU")}` : "")
            }</CardDescription>
            </CardHeader>
            <CardContent className="grid text-sm">
                <dl className="text-gray-900 divide-y divide-gray-200 dark:text-white dark:divide-gray-700 overflow-hidden">
                    { 'hostnames' in machine && machine.hostnames.length ? (
                        <div className="flex flex-col py-3 first:pt-0">
                            <Popover>
                                <dt className="mb-1 text-gray-500 dark:text-gray-400">{pluralize(machine.hostnames.length, "Hostname")}{<PopoverTrigger><HelpCircle className="ml-1 mr-1 h-3 w-3 text-muted-foreground" /></PopoverTrigger>}</dt>
                                <PopoverContent side="top">
                                    <p><Code>*.cluster.watonomous.ca</Code> hostnames resolve to internal IP addresses in the cluster. They are accessible only from within the cluster.</p>
                                    <p><Code>*.watonomous.ca</Code> hostnames resolve to external IP addresses. They are accessible from anywhere. However, they may be behind the UWaterloo firewall. To access them, you may need to use a VPN or a bastion server.</p>
                                </PopoverContent>
                            </Popover>
                            <dd className="font-semibold">
                                <ul className="list-none">
                                    <TooltipProvider>
                                        {machine.hostnames.length ? machine.hostnames.sort(hostnameSorter).map((hostname, index) => {
                                            return (
                                                <li key={index} className="my-0">
                                                    <Tooltip key={index}>
                                                        <TooltipTrigger className='text-start'><Link className="text-inherit decoration-dashed" href={`/docs/compute-cluster/ssh?hostname=${hostname}#command-generator`}>{hostname}</Link></TooltipTrigger>
                                                        <TooltipContent side="top">
                                                            <p className='font-normal'>Click to see SSH instructions for accessing <Code>{machine.name}</Code> via <Code>{hostname}</Code></p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </li>
                                            )
                                        }) : "None"}
                                    </TooltipProvider>
                                </ul>
                            </dd>
                        </div>
                    ) : undefined}
                    { 'lsb_release_info' in machine && machine.lsb_release_info ? (
                        <div className="flex flex-col py-3 first:pt-0">
                            <dt className="mb-1 text-gray-500 dark:text-gray-400">OS</dt>
                            <dd className="font-semibold">{machine.lsb_release_info['description']}</dd>
                        </div>
                    ) : undefined}
                    <div className="flex flex-col py-3 first:pt-0">
                        <dt className="mb-1 text-gray-500 dark:text-gray-400">
                            {isVM ? (
                                <Popover>
                                    <span>CPU{<PopoverTrigger><HelpCircle className="ml-1 mr-1 h-3 w-3 text-muted-foreground" /></PopoverTrigger>}</span>
                                    <PopoverContent side="top">
                                        <p>{machine.name} is a virtual machine. The CPU model is the model of the emulated CPU (usually the same as the host CPU).</p>
                                    </PopoverContent>
                                </Popover>
                            ): (
                                <span>CPU</span>
                            )}
                        </dt>
                        <dd className="font-semibold">{machine.cpu_info['model']}</dd>
                    </div>
                    <div className="flex flex-col py-3 first:pt-0">
                        <dt className="mb-1 text-gray-500 dark:text-gray-400">
                            <Popover>
                                <span>Logical Processors{<PopoverTrigger><HelpCircle className="ml-1 mr-1 h-3 w-3 text-muted-foreground" /></PopoverTrigger>}</span>
                                <PopoverContent side="top">
                                    {isVM ? (
                                        <p>{"The total number of logical processors available to the machine. In virtual machines, this number may be lower than the CPU's specs."}</p>
                                    ) : (
                                        <p>The total number of logical processors available to the machine. This is often <Code>num_physical_cores * num_threads_per_core.</Code></p>
                                    )}
                                </PopoverContent>
                            </Popover>
                        </dt>
                        <dd className="font-semibold">{machine.cpu_info['logical_processors']}</dd>
                    </div>
                    <div className="flex flex-col py-3 first:pt-0">
                        <dt className="mb-1 text-gray-500 dark:text-gray-400">RAM</dt>
                        <dd className="font-semibold">{bytesToSize(parseInt(machine.memory_info["memory_total_kibibytes"])*1024, 0)}</dd>
                    </div>
                    { 'gpus' in machine && machine.gpus.length ? (
                        <div className="flex flex-col py-3 first:pt-0">
                            <dt className="mb-1 text-gray-500 dark:text-gray-400">{pluralize(machine.gpus.length, "GPU")}</dt>
                            <dd className="font-semibold">
                                <ol start={0}>
                                    {machine.gpus.length ? machine.gpus.map((gpu, index) => {
                                        return (
                                            <li key={index} className="my-0">
                                                {gpu['name']} ({gpu['memory.total [MiB]']} VRAM)
                                            </li>
                                        )
                                    }) : "None"}
                                </ol>
                            </dd>
                        </div>
                    ) : undefined}
                    { 'hosted_storage' in machine && machine.hosted_storage.length ? (
                        <div className="flex flex-col py-3 first:pt-0">
                            <dt className="mb-1 text-gray-500 dark:text-gray-400">Hosted Storage</dt>
                            <dd className="font-semibold">
                                <ol start={0}>
                                    {machine.hosted_storage.length ? machine.hosted_storage.map((storage, index) => {
                                        return (
                                            <li key={index} className="my-0">
                                                {storage['mountpoint']} ({bytesToSize(parseInt(storage['size_bytes']), 0)})
                                            </li>
                                        )
                                    }) : "None"}
                                </ol>
                            </dd>
                        </div>
                    ) : undefined}
                    { 'ssh_host_keys' in machine && machine.ssh_host_keys.length ? (
                        <div className="flex flex-col py-3 first:pt-0">
                            <dt className="mb-1 text-gray-500 dark:text-gray-400">{pluralize(machine.ssh_host_keys.length, "SSH Host Key")}</dt>
                            <dd>
                                <Pre hasCopyCode>
                                    <Code>
                                        {machine.ssh_host_keys.join('\n')}
                                    </Code>
                                </Pre>
                            </dd>
                        </div>
                    ) : undefined}
                    { 'ssh_host_keys_bastion' in machine && machine.ssh_host_keys_bastion.length ? (
                        <div className="flex flex-col py-3 first:pt-0">
                            <Popover>
                                <dt className="mb-1 text-gray-500 dark:text-gray-400">{pluralize(machine.ssh_host_keys_bastion.length, "SSH Host Key")} (Bastion){<PopoverTrigger><HelpCircle className="ml-1 mr-1 h-3 w-3 text-muted-foreground" /></PopoverTrigger>}</dt>
                                <PopoverContent side="top">
                                    <p>To improve security, we use a secondary, hardened SSH server on this machine for general access. This SSH server has a different set of host keys than the primary server, as shown below. The primary SSH server is accessible only to cluster administrators.</p>
                                </PopoverContent>
                            </Popover>
                            <dd>
                                <Pre hasCopyCode>
                                    <Code>
                                        {machine.ssh_host_keys_bastion.join('\n')}
                                    </Code>
                                </Pre>
                            </dd>
                        </div>
                    ) : undefined}
                </dl>
            </CardContent>
        </Card>
    )
}
